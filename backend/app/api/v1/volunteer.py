"""Volunteer portal endpoints."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, get_current_user
from app.api.vol_deps import get_active_volunteer, get_current_volunteer
from app.core.exceptions import NotFoundError, ValidationError
from app.db.session import get_db
from app.models.case_attachment import CaseAttachment
from app.models.enums import AssignmentStatus, VolunteerAssignmentMode
from app.models.ngo import NGO
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.volunteer_assignment import VolunteerAssignment
from app.schemas.auth import MessageResponse
from app.schemas.vol import (
    AssignmentReportInfo,
    CompleteAssignmentRequest,
    VolAssignmentModeUpdate,
    VolAssignmentOut,
    VolDashboard,
    VolPerformance,
    VolProfileOut,
    VolProfileUpdate,
)
from app.services.images import process_image
from app.services.security_sanitize import sanitize_text
from app.services.storage import StorageBackend, get_storage
from app.services.uploads import read_limited
from app.services.vol_service import VolService

router = APIRouter(prefix="/volunteer", tags=["volunteer"])


def _csv(raw: str | None) -> list[str]:
    return [s.strip() for s in (raw or "").split(",") if s.strip()]


def _profile_out(v: Volunteer, storage: StorageBackend) -> VolProfileOut:
    return VolProfileOut(
        id=v.id,
        name=(v.user.full_name or v.user.email) if v.user else None,
        email=v.user.email if v.user else None,
        phone=v.phone,
        role_title=v.role_title,
        availability=v.availability,
        status=v.status,
        is_available=v.is_available,
        assignment_mode=v.assignment_mode,
        ngo_id=v.ngo_id,
        ngo_name=v.ngo.name if v.ngo else None,
        skills=_csv(v.skills),
        certifications=_csv(v.certifications),
        languages=_csv(v.languages),
        emergency_contact=v.emergency_contact,
        working_radius_km=v.working_radius_km,
        schedule=v.schedule,
        avatar_url=storage.url_for(v.avatar_key) if v.avatar_key else None,
        completed_rescues=v.completed_rescues,
        total_hours=v.total_hours,
        rating=v.rating,
    )


def _assignment_out(a: VolunteerAssignment) -> VolAssignmentOut:
    r = a.report
    return VolAssignmentOut(
        id=a.id, status=a.status, responded_at=a.responded_at,
        completed_at=a.completed_at, notes=a.notes, created_at=a.created_at,
        report=AssignmentReportInfo(
            id=r.id, tracking_id=r.tracking_id, situation=r.situation,
            priority=r.priority, status=r.status, address=r.address,
            latitude=r.latitude, longitude=r.longitude, description=r.description,
        ),
    )


# --- Profile ---

@router.get("/profile", response_model=VolProfileOut)
def get_profile(
    v: Volunteer = Depends(get_current_volunteer),
    storage: StorageBackend = Depends(get_storage),
) -> VolProfileOut:
    return _profile_out(v, storage)


@router.patch("/profile", response_model=VolProfileOut)
def update_profile(
    body: VolProfileUpdate,
    v: Volunteer = Depends(get_current_volunteer),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> VolProfileOut:
    data = body.model_dump(exclude_unset=True)
    # Sanitize list items, then join to the stored comma-string.
    for list_field in ("skills", "certifications", "languages"):
        if data.get(list_field) is not None:
            data[list_field] = ", ".join(
                s for s in (sanitize_text(x) for x in data[list_field]) if s
            )
    # Sanitize scalar free-text fields.
    for text_field in ("phone", "role_title", "availability", "emergency_contact", "schedule"):
        if data.get(text_field) is not None:
            data[text_field] = sanitize_text(data[text_field])
    for field, value in data.items():
        setattr(v, field, value)
    db.commit()
    db.refresh(v)
    return _profile_out(v, storage)


@router.post("/profile/avatar", response_model=VolProfileOut)
async def upload_avatar(
    file: UploadFile = File(...),
    v: Volunteer = Depends(get_current_volunteer),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> VolProfileOut:
    raw = await read_limited(file)
    if not raw:
        raise ValidationError("Empty file", code="empty_file")
    processed = process_image(raw, original_filename=file.filename)
    key = storage.save(processed.data, subdir=f"vol-avatars/{v.id}", ext=processed.ext)
    if v.avatar_key:
        storage.delete(v.avatar_key)
    v.avatar_key = key
    db.commit()
    db.refresh(v)
    return _profile_out(v, storage)


@router.post("/availability", response_model=VolProfileOut)
def toggle_availability(
    available: bool,
    v: Volunteer = Depends(get_current_volunteer),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> VolProfileOut:
    v.is_available = available
    db.commit()
    db.refresh(v)
    return _profile_out(v, storage)


@router.put("/assignment-mode", response_model=VolProfileOut)
def set_assignment_mode(
    body: VolAssignmentModeUpdate,
    v: Volunteer = Depends(get_current_volunteer),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> VolProfileOut:
    """Choose Independent vs NGO-affiliated. Affiliating requires a preferred
    NGO; choosing Independent clears the association (i.e. leaves the NGO)."""
    if body.mode == VolunteerAssignmentMode.NGO_AFFILIATED:
        if body.ngo_id is None:
            raise ValidationError(
                "A preferred NGO is required to affiliate", code="ngo_required"
            )
        ngo = db.get(NGO, body.ngo_id)
        if not ngo or not ngo.is_verified:
            raise NotFoundError("Verified NGO not found", code="ngo_not_found")
        v.assignment_mode = VolunteerAssignmentMode.NGO_AFFILIATED
        v.ngo_id = ngo.id
    else:
        v.assignment_mode = VolunteerAssignmentMode.INDEPENDENT
        v.ngo_id = None
    db.commit()
    db.refresh(v)
    return _profile_out(v, storage)


# --- Dashboard ---

@router.get("/dashboard", response_model=VolDashboard)
def dashboard(
    v: Volunteer = Depends(get_current_volunteer),
    db: Session = Depends(get_db),
) -> VolDashboard:
    service = VolService(db)
    all_assignments = service.assignments_for(v)

    # Surface the assignment furthest along the workflow as "active" (not just
    # the most recently created), breaking ties by latest response/creation.
    active_rank = {
        AssignmentStatus.ACCEPTED: 0,
        AssignmentStatus.ON_ROUTE: 1,
        AssignmentStatus.ARRIVED: 2,
        AssignmentStatus.IN_PROGRESS: 3,
    }
    active_candidates = [a for a in all_assignments if a.status in active_rank]
    active = max(
        active_candidates,
        key=lambda a: (active_rank[a.status], a.responded_at or a.created_at),
        default=None,
    )
    upcoming = [a for a in all_assignments if a.status == AssignmentStatus.ASSIGNED]
    today = [
        a for a in all_assignments
        if a.created_at.date() == datetime.now(timezone.utc).date()
    ]
    completed_count = sum(1 for a in all_assignments if a.status == AssignmentStatus.COMPLETED)

    return VolDashboard(
        today=[_assignment_out(a) for a in today],
        active=_assignment_out(active) if active else None,
        upcoming=[_assignment_out(a) for a in upcoming],
        completed_count=completed_count,
        total_hours=v.total_hours,
        is_available=v.is_available,
        acceptance_rate=service.acceptance_rate(v),
    )


@router.get("/assignments", response_model=list[VolAssignmentOut])
def list_assignments(
    v: Volunteer = Depends(get_current_volunteer),
    db: Session = Depends(get_db),
) -> list[VolAssignmentOut]:
    return [_assignment_out(a) for a in VolService(db).assignments_for(v)]


@router.get("/assignments/{assignment_id}", response_model=VolAssignmentOut)
def get_assignment(
    assignment_id: uuid.UUID,
    v: Volunteer = Depends(get_current_volunteer),
    db: Session = Depends(get_db),
) -> VolAssignmentOut:
    a = VolService(db)._load_assignment(assignment_id, v)  # noqa: SLF001
    return _assignment_out(a)


# --- Assignment workflow ---

@router.post("/assignments/{assignment_id}/respond", response_model=VolAssignmentOut)
def respond(
    request: Request,
    assignment_id: uuid.UUID,
    accept: bool,
    v: Volunteer = Depends(get_active_volunteer),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VolAssignmentOut:
    a = VolService(db).respond(v, assignment_id, accept, actor_id=user.id)
    db.commit()
    db.refresh(a)
    return _assignment_out(a)


@router.post("/assignments/{assignment_id}/advance", response_model=VolAssignmentOut)
def advance(
    assignment_id: uuid.UUID,
    to: AssignmentStatus,
    v: Volunteer = Depends(get_active_volunteer),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VolAssignmentOut:
    a = VolService(db).advance(v, assignment_id, to, actor_id=user.id)
    db.commit()
    db.refresh(a)
    return _assignment_out(a)


@router.post("/assignments/{assignment_id}/complete", response_model=VolAssignmentOut)
def complete(
    assignment_id: uuid.UUID,
    body: CompleteAssignmentRequest,
    v: Volunteer = Depends(get_active_volunteer),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VolAssignmentOut:
    a = VolService(db).complete(
        v, assignment_id, actor_id=user.id,
        notes=body.notes, checklist=body.checklist, hours=body.hours,
    )
    db.commit()
    db.refresh(a)
    return _assignment_out(a)


@router.post("/assignments/{assignment_id}/images", response_model=MessageResponse)
async def upload_completion_image(
    assignment_id: uuid.UUID,
    file: UploadFile = File(...),
    v: Volunteer = Depends(get_active_volunteer),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> MessageResponse:
    a = VolService(db)._load_assignment(assignment_id, v)  # noqa: SLF001
    raw = await read_limited(file)
    if not raw:
        raise ValidationError("Empty file", code="empty_file")
    processed = process_image(raw, original_filename=file.filename)
    key = storage.save(processed.data, subdir=f"case-attachments/{a.report_id}", ext=processed.ext)
    db.add(CaseAttachment(
        report_id=a.report_id, uploaded_by_id=user.id, storage_key=key,
        original_filename=file.filename, content_type=processed.content_type,
        size_bytes=processed.size_bytes, category="rescue_photo",
    ))
    db.commit()
    return MessageResponse(message="Image uploaded")


# --- Performance ---

@router.get("/performance", response_model=VolPerformance)
def performance(
    v: Volunteer = Depends(get_current_volunteer),
    db: Session = Depends(get_db),
) -> VolPerformance:
    service = VolService(db)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly = db.scalar(
        select(func.count()).select_from(VolunteerAssignment).where(
            VolunteerAssignment.volunteer_id == v.id,
            VolunteerAssignment.status == AssignmentStatus.COMPLETED,
            VolunteerAssignment.completed_at >= month_start,
        )
    ) or 0
    # Average response time (assigned -> responded).
    responded = db.scalars(
        select(VolunteerAssignment).where(
            VolunteerAssignment.volunteer_id == v.id,
            VolunteerAssignment.responded_at.is_not(None),
        )
    ).all()
    deltas = [(a.responded_at - a.created_at).total_seconds() / 60 for a in responded]
    avg_resp = round(sum(deltas) / len(deltas), 1) if deltas else None

    return VolPerformance(
        total_rescues=v.completed_rescues,
        monthly_rescues=monthly,
        acceptance_rate=service.acceptance_rate(v),
        total_hours=v.total_hours,
        avg_response_minutes=avg_resp,
        badges=service.badges(v),
    )
