"""Semantic search + duplicate detection/merge (NGO-scoped)."""

import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import client_ip, get_current_user
from app.api.ngo_deps import get_current_ngo
from app.core.exceptions import NotFoundError, ValidationError
from app.db.session import get_db
from app.models.ngo import NGO
from app.models.report import Report
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.services import dedup, semantic_search
from app.services.audit import record_audit

router = APIRouter(prefix="/ngo", tags=["ngo:discovery"])


@router.get("/search")
def semantic_report_search(
    q: str = Query(..., min_length=2, max_length=300),
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
) -> dict:
    """Natural-language report search, e.g. 'children needing shelter today'."""
    return semantic_search.search(db, ngo, q)


@router.get("/reports/{report_id}/duplicates")
def report_duplicates(
    report_id: uuid.UUID,
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
) -> dict:
    """Suggested duplicate reports describing the same person/situation."""
    report = db.get(Report, report_id)
    if not report:
        raise NotFoundError("Report not found")
    return {"duplicates": dedup.find_duplicates(db, report)}


class MergeRequest(BaseModel):
    duplicate_id: uuid.UUID


@router.post("/reports/{report_id}/merge", response_model=MessageResponse)
def merge_duplicate(
    request: Request,
    report_id: uuid.UUID,
    body: MergeRequest,
    ngo: NGO = Depends(get_current_ngo),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Mark `duplicate_id` as a duplicate of `report_id` (non-destructive)."""
    primary = db.get(Report, report_id)
    duplicate = db.get(Report, body.duplicate_id)
    if not primary or not duplicate:
        raise NotFoundError("Report not found")
    if primary.id == duplicate.id:
        raise ValidationError("A report cannot be a duplicate of itself", code="self_merge")
    dedup.merge_reports(db, primary, duplicate)
    record_audit(
        db, action="report.merge_duplicate", actor_id=user.id,
        entity_type="report", entity_id=str(duplicate.id), ip_address=client_ip(request),
        meta={"primary": str(primary.id)},
    )
    db.commit()
    return MessageResponse(message=f"Marked {duplicate.tracking_id} as a duplicate of {primary.tracking_id}")
