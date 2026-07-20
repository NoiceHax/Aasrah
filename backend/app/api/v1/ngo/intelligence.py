"""NGO-facing intelligence endpoints: AI overrides, matching, recommendations."""

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import client_ip, get_current_user
from app.api.ngo_deps import get_current_ngo
from app.api.v1.ngo.reports import _case_detail
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.ngo import NGO
from app.models.report import Report
from app.models.user import User
from app.schemas.report import (
    AnalysisOverrideRequest,
    CaseDetailOut,
    PriorityOverrideRequest,
)
from app.services.audit import record_audit
from app.services.intelligence import rank_ngos_for_report, recommend_volunteers
from app.services.storage import StorageBackend, get_storage

router = APIRouter(prefix="/ngo", tags=["ngo:intelligence"])


def _owned(db: Session, ngo: NGO, report_id: uuid.UUID) -> Report:
    report = db.get(Report, report_id)
    if not report:
        raise NotFoundError("Case not found")
    if report.claimed_by_ngo_id != ngo.id:
        raise ForbiddenError("This case is not assigned to your organization", code="not_your_case")
    return report


@router.patch("/reports/{report_id}/priority", response_model=CaseDetailOut)
def override_priority(
    request: Request,
    report_id: uuid.UUID,
    body: PriorityOverrideRequest,
    ngo: NGO = Depends(get_current_ngo),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> CaseDetailOut:
    report = _owned(db, ngo, report_id)
    report.priority = body.priority
    report.priority_auto = False  # stop auto-scoring from overwriting the human call
    record_audit(
        db, action="report.priority_override", actor_id=user.id,
        entity_type="report", entity_id=str(report.id), ip_address=client_ip(request),
        meta={"priority": body.priority.value},
    )
    db.commit()
    return _case_detail(db, storage, ngo, report_id)


@router.patch("/reports/{report_id}/analysis", response_model=CaseDetailOut)
def override_analysis(
    report_id: uuid.UUID,
    body: AnalysisOverrideRequest,
    ngo: NGO = Depends(get_current_ngo),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> CaseDetailOut:
    report = _owned(db, ngo, report_id)
    analysis = dict(report.ai_analysis or {})
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            analysis[field] = value
    analysis["source"] = "ngo_override"
    report.ai_analysis = analysis
    # Mirror children_present onto the report flag if corrected.
    if body.children_present is not None:
        report.children_present = body.children_present
    record_audit(
        db, action="report.analysis_override", actor_id=user.id,
        entity_type="report", entity_id=str(report.id),
    )
    db.commit()
    return _case_detail(db, storage, ngo, report_id)


@router.get("/reports/{report_id}/match")
def ngo_match_candidates(
    report_id: uuid.UUID,
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
) -> dict:
    """Ranked NGO candidates for a report (used to see where else it could route)."""
    report = _owned(db, ngo, report_id)
    return {"candidates": rank_ngos_for_report(db, report)}


@router.get("/reports/{report_id}/recommended-volunteers")
def recommended_volunteers(
    report_id: uuid.UUID,
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
) -> dict:
    """Recommended volunteers for the NGO's claimed case."""
    report = _owned(db, ngo, report_id)
    return {"recommended": recommend_volunteers(db, report, ngo)}
