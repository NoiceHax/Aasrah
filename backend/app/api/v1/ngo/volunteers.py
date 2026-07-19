"""Volunteer management + case assignment (NGO-scoped)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import client_ip, get_current_user
from app.api.ngo_deps import get_current_ngo, resolve_acting_ngo_for_report
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.db.session import get_db
from app.models.enums import AssignmentStatus, NotificationType, ReportStatus
from app.models.ngo import NGO
from app.models.report import Report
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.volunteer_assignment import VolunteerAssignment
from app.schemas.auth import MessageResponse
from app.schemas.volunteer import (
    AssignmentCreate,
    AssignmentOut,
    VolunteerOut,
    VolunteerUpdate,
)
from app.services.audit import add_timeline_event, notify, record_audit

router = APIRouter(prefix="/ngo", tags=["ngo:volunteers"])


def _skills_list(raw: str | None) -> list[str]:
    return [s.strip() for s in (raw or "").split(",") if s.strip()]


def _volunteer_out(v: Volunteer, active_count: int = 0) -> VolunteerOut:
    # Build explicitly: the ORM stores `skills` as a comma-string, which would
    # fail validation against the schema's list[str] if read via model_validate.
    return VolunteerOut(
        id=v.id,
        user_id=v.user_id,
        name=(v.user.full_name or v.user.email) if v.user else None,
        email=v.user.email if v.user else None,
        phone=v.phone,
        role_title=v.role_title,
        availability=v.availability,
        skills=_skills_list(v.skills),
        status=v.status,
        is_available=v.is_available,
        completed_rescues=v.completed_rescues,
        rating=v.rating,
        active_assignments=active_count,
    )


# --- Volunteer management ---

@router.get("/volunteers", response_model=list[VolunteerOut])
def list_volunteers(
    search: str | None = Query(default=None, max_length=200),
    available_only: bool = Query(default=False),
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
) -> list[VolunteerOut]:
    stmt = (
        select(Volunteer)
        .where(Volunteer.ngo_id == ngo.id)
        .options(selectinload(Volunteer.user))
    )
    if available_only:
        stmt = stmt.where(Volunteer.is_available.is_(True))
    volunteers = list(db.scalars(stmt).all())

    if search:
        term = search.strip().lower()
        volunteers = [
            v for v in volunteers
            if term in ((v.user.full_name or "") + (v.user.email or "") + (v.skills or "")).lower()
        ]

    # Count active (assigned/accepted) assignments per volunteer.
    out: list[VolunteerOut] = []
    for v in volunteers:
        active = db.scalar(
            select(func.count())
            .select_from(VolunteerAssignment)
            .where(
                VolunteerAssignment.volunteer_id == v.id,
                VolunteerAssignment.status.in_(
                    [AssignmentStatus.ASSIGNED, AssignmentStatus.ACCEPTED]
                ),
            )
        ) or 0
        out.append(_volunteer_out(v, active))
    return out


@router.patch("/volunteers/{volunteer_id}", response_model=VolunteerOut)
def update_volunteer(
    volunteer_id: uuid.UUID,
    body: VolunteerUpdate,
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
) -> VolunteerOut:
    v = db.get(Volunteer, volunteer_id)
    if not v or v.ngo_id != ngo.id:
        raise NotFoundError("Volunteer not found")
    data = body.model_dump(exclude_unset=True)
    if "skills" in data and data["skills"] is not None:
        data["skills"] = ", ".join(data["skills"])
    for field, value in data.items():
        setattr(v, field, value)
    db.commit()
    db.refresh(v)
    return _volunteer_out(v)


# --- Assignments ---

def _assignment_out(a: VolunteerAssignment) -> AssignmentOut:
    out = AssignmentOut.model_validate(a)
    if a.volunteer and a.volunteer.user:
        out.volunteer_name = a.volunteer.user.full_name or a.volunteer.user.email
    return out


def _load_case_and_ngo(db: Session, user: User, report_id: uuid.UUID) -> tuple[Report, NGO]:
    """Load a case and the NGO the user acts as for it.

    For an NGO user the acting NGO is their own org (which must own the case).
    For an admin it is the case's owning NGO. Either way the returned NGO is the
    case owner, so downstream ``ngo.id`` checks continue to hold.
    """
    report = db.get(Report, report_id)
    if not report:
        raise NotFoundError("Case not found")
    ngo = resolve_acting_ngo_for_report(db, user, report)
    if report.claimed_by_ngo_id != ngo.id:
        raise ForbiddenError("This case is not assigned to your organization", code="not_your_case")
    return report, ngo


@router.get("/reports/{report_id}/assignments", response_model=list[AssignmentOut])
def list_assignments(
    report_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AssignmentOut]:
    _load_case_and_ngo(db, user, report_id)
    stmt = (
        select(VolunteerAssignment)
        .where(VolunteerAssignment.report_id == report_id)
        .options(selectinload(VolunteerAssignment.volunteer).selectinload(Volunteer.user))
        .order_by(VolunteerAssignment.created_at.desc())
    )
    return [_assignment_out(a) for a in db.scalars(stmt).all()]


@router.post("/reports/{report_id}/assignments", response_model=list[AssignmentOut], status_code=201)
def assign_volunteers(
    request: Request,
    report_id: uuid.UUID,
    body: AssignmentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AssignmentOut]:
    report, ngo = _load_case_and_ngo(db, user, report_id)
    created: list[VolunteerAssignment] = []

    for vid in body.volunteer_ids:
        v = db.get(Volunteer, vid)
        if not v or v.ngo_id != ngo.id:
            raise ValidationError(f"Volunteer {vid} is not part of your organization", code="invalid_volunteer")

        existing = db.scalars(
            select(VolunteerAssignment).where(
                VolunteerAssignment.report_id == report_id,
                VolunteerAssignment.volunteer_id == vid,
            )
        ).first()
        if existing and existing.status in (AssignmentStatus.ASSIGNED, AssignmentStatus.ACCEPTED):
            continue  # already actively assigned; skip
        if existing:
            # Re-activate a previously removed/declined assignment.
            existing.status = AssignmentStatus.ASSIGNED
            existing.assigned_by_id = user.id
            existing.responded_at = None
            existing.completed_at = None
            created.append(existing)
        else:
            a = VolunteerAssignment(
                report_id=report_id, volunteer_id=vid,
                assigned_by_id=user.id, status=AssignmentStatus.ASSIGNED,
            )
            db.add(a)
            created.append(a)

        if v.user:
            notify(
                db, user_id=v.user_id,
                title="New rescue assignment",
                body=f"You've been assigned to case {report.tracking_id}.",
                type_=NotificationType.INFO,
            )

    if created:
        add_timeline_event(
            db, report_id=report_id, event_type="volunteer_assigned",
            title="Volunteer Assigned",
            description=f"{len(created)} volunteer(s) assigned.",
            actor_id=user.id, is_public=True,
        )
        # Advance status to volunteer_assigned if still at claimed.
        if report.status == ReportStatus.CLAIMED:
            report.status = ReportStatus.VOLUNTEER_ASSIGNED
        record_audit(
            db, action="case.assign_volunteers", actor_id=user.id,
            entity_type="report", entity_id=str(report_id), ip_address=client_ip(request),
            meta={"count": len(created)},
        )
    db.commit()
    for a in created:
        db.refresh(a)
    return [_assignment_out(a) for a in created]


@router.post("/assignments/{assignment_id}/respond", response_model=AssignmentOut)
def respond_to_assignment(
    request: Request,
    assignment_id: uuid.UUID,
    accept: bool = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssignmentOut:
    """A volunteer accepts or declines their own assignment."""
    a = db.scalars(
        select(VolunteerAssignment)
        .where(VolunteerAssignment.id == assignment_id)
        .options(selectinload(VolunteerAssignment.volunteer).selectinload(Volunteer.user))
    ).first()
    if not a:
        raise NotFoundError("Assignment not found")
    if not a.volunteer or a.volunteer.user_id != user.id:
        raise ForbiddenError("This assignment is not yours", code="not_your_assignment")
    if a.status != AssignmentStatus.ASSIGNED:
        raise ConflictError("This assignment has already been responded to", code="already_responded")

    a.status = AssignmentStatus.ACCEPTED if accept else AssignmentStatus.DECLINED
    a.responded_at = datetime.now(timezone.utc)

    report = db.get(Report, a.report_id)
    if report:
        add_timeline_event(
            db, report_id=report.id,
            event_type="volunteer_accepted" if accept else "volunteer_declined",
            title="Volunteer Accepted" if accept else "Volunteer Declined",
            actor_id=user.id, is_public=accept,
        )
        if accept and report.status == ReportStatus.VOLUNTEER_ASSIGNED:
            report.status = ReportStatus.VOLUNTEER_ACCEPTED
        # Notify the NGO owner.
        if report.claimed_by and report.claimed_by.owner_id:
            notify(
                db, user_id=report.claimed_by.owner_id,
                title=f"Volunteer {'accepted' if accept else 'declined'}",
                body=f"{a.volunteer.user.full_name or a.volunteer.user.email} "
                     f"{'accepted' if accept else 'declined'} case {report.tracking_id}.",
                type_=NotificationType.SUCCESS if accept else NotificationType.WARNING,
            )
    db.commit()
    db.refresh(a)
    return _assignment_out(a)


@router.delete("/reports/{report_id}/assignments/{assignment_id}", response_model=MessageResponse)
def remove_assignment(
    report_id: uuid.UUID,
    assignment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    _load_case_and_ngo(db, user, report_id)
    a = db.get(VolunteerAssignment, assignment_id)
    if not a or a.report_id != report_id:
        raise NotFoundError("Assignment not found")
    a.status = AssignmentStatus.REMOVED
    db.commit()
    return MessageResponse(message="Assignment removed")
