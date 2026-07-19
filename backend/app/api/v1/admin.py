"""Admin console endpoints. All require the ADMIN role."""

import math
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, require_roles
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.security import hash_password
from app.db.session import get_db
from app.models.announcement import Announcement
from app.models.audit_log import AuditLog
from app.models.enums import (
    AnnouncementAudience,
    NotificationType,
    ReportStatus,
    UserRole,
    VolunteerStatus,
)
from app.models.ngo import NGO
from app.models.report import Report
from app.models.user import User
from app.models.volunteer import Volunteer
from app.schemas.admin import (
    AdminDashboard,
    AdminKpis,
    AdminNgoOut,
    AdminUserOut,
    AdminVolunteerOut,
    AnnouncementCreate,
    AnnouncementOut,
    AuditLogOut,
    NgoCreate,
    PaginatedAuditLogs,
    PaginatedUsers,
)
from app.schemas.auth import MessageResponse
from app.services.audit import notify, record_audit
from app.services.email import templates as email_templates
from app.services.email.sender import queue_email
from app.services.realtime import bus


def _csv(raw: str | None) -> list[str]:
    return [s.strip() for s in (raw or "").split(",") if s.strip()]


def _admin_volunteer_out(v: Volunteer) -> AdminVolunteerOut:
    return AdminVolunteerOut(
        id=v.id,
        user_id=v.user_id,
        name=(v.user.full_name or v.user.email) if v.user else None,
        email=v.user.email if v.user else None,
        phone=v.phone,
        status=v.status,
        assignment_mode=v.assignment_mode,
        ngo_id=v.ngo_id,
        ngo_name=v.ngo.name if v.ngo else None,
        skills=_csv(v.skills),
        completed_rescues=v.completed_rescues,
        created_at=v.created_at,
    )

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_roles(UserRole.ADMIN))])

_CLOSED = {ReportStatus.CLOSED, ReportStatus.RESOLVED, ReportStatus.RESCUE_COMPLETED, ReportStatus.SHELTER_ASSIGNED}


# --- Dashboard ---

@router.get("/dashboard", response_model=AdminDashboard)
def dashboard(db: Session = Depends(get_db)) -> AdminDashboard:
    total_reports = db.scalar(select(func.count()).select_from(Report)) or 0
    closed = db.scalar(
        select(func.count()).select_from(Report).where(Report.status.in_(_CLOSED))
    ) or 0
    active = total_reports - closed
    ngos = db.scalar(select(func.count()).select_from(NGO)) or 0
    vols = db.scalar(select(func.count()).select_from(Volunteer)) or 0
    active_users = db.scalar(
        select(func.count()).select_from(User).where(User.is_active.is_(True))
    ) or 0
    pending_ngos = db.scalar(
        select(func.count()).select_from(NGO).where(NGO.is_verified.is_(False))
    ) or 0
    pending_vols = db.scalar(
        select(func.count()).select_from(Volunteer).where(
            Volunteer.status == VolunteerStatus.PENDING
        )
    ) or 0

    now = datetime.now(timezone.utc)
    report_trend = []
    for d in range(13, -1, -1):
        day = (now - timedelta(days=d)).date()
        cnt = db.scalar(
            select(func.count()).select_from(Report).where(func.date(Report.created_at) == day)
        ) or 0
        report_trend.append({"label": day.isoformat()[5:], "value": cnt})

    user_growth = []
    for w in range(7, -1, -1):
        start = now - timedelta(weeks=w + 1)
        end = now - timedelta(weeks=w)
        cnt = db.scalar(
            select(func.count()).select_from(User).where(User.created_at < end)
        ) or 0
        user_growth.append({"label": f"W-{w}", "value": cnt})

    recent = db.scalars(select(User).order_by(User.created_at.desc()).limit(8)).all()
    recent_registrations = [
        {"id": str(u.id), "name": u.full_name or u.email, "role": u.role.value,
         "created_at": u.created_at.isoformat()}
        for u in recent
    ]

    heatmap = [
        {"latitude": r.latitude, "longitude": r.longitude, "weight": 1}
        for r in db.scalars(
            select(Report).where(Report.latitude.is_not(None)).limit(500)
        ).all()
    ]

    return AdminDashboard(
        kpis=AdminKpis(
            total_reports=total_reports, active_cases=active, closed_cases=closed,
            registered_ngos=ngos, registered_volunteers=vols, active_users=active_users,
            pending_verifications=pending_ngos, pending_volunteers=pending_vols,
        ),
        report_trend=report_trend, user_growth=user_growth,
        recent_registrations=recent_registrations, heatmap=heatmap,
    )


# --- NGO verification ---

@router.get("/ngos", response_model=list[AdminNgoOut])
def list_ngos(
    pending_only: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[AdminNgoOut]:
    stmt = select(NGO).order_by(NGO.created_at.desc())
    if pending_only:
        stmt = stmt.where(NGO.is_verified.is_(False))
    return [AdminNgoOut.model_validate(n) for n in db.scalars(stmt).all()]


@router.post("/ngos/{ngo_id}/verify", response_model=AdminNgoOut)
def verify_ngo(
    request: Request,
    ngo_id: uuid.UUID,
    approve: bool = Query(...),
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AdminNgoOut:
    ngo = db.get(NGO, ngo_id)
    if not ngo:
        raise NotFoundError("NGO not found")
    ngo.is_verified = approve
    record_audit(
        db, action="ngo.verify" if approve else "ngo.reject", actor_id=user.id,
        entity_type="ngo", entity_id=str(ngo.id), ip_address=client_ip(request),
    )
    if ngo.owner_id:
        notify(
            db, user_id=ngo.owner_id,
            title=f"Organization {'verified' if approve else 'rejected'}",
            body=f"{ngo.name} has been {'approved' if approve else 'rejected'} by an administrator.",
            type_=NotificationType.SUCCESS if approve else NotificationType.WARNING,
        )
        if approve and ngo.owner and ngo.owner.email:
            queue_email(
                ngo.owner.email,
                email_templates.ngo_approved(ngo.owner.full_name or "there", ngo.name),
            )
    db.commit()
    db.refresh(ngo)
    return AdminNgoOut.model_validate(ngo)


# --- NGO provisioning (admin-created; no public registration) ---

@router.post("/ngos", response_model=AdminNgoOut, status_code=201)
def create_ngo(
    request: Request,
    body: NgoCreate,
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AdminNgoOut:
    """Provision an NGO account: creates an owner User (NGO role) with a
    temporary password plus the NGO record. NGOs are never self-registered."""
    email = body.owner_email.lower().strip()
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise ConflictError("An account with this email already exists", code="email_taken")
    owner = User(
        email=email,
        hashed_password=hash_password(body.temp_password),
        full_name=body.owner_full_name,
        role=UserRole.NGO,
        is_active=True,
        is_verified=True,
    )
    db.add(owner)
    db.flush()  # assign owner.id
    ngo = NGO(
        owner_id=owner.id,
        name=body.name,
        focus_area=body.focus_area,
        location=body.location,
        description=body.description,
        contact_email=body.contact_email or email,
        contact_phone=body.contact_phone,
        is_verified=body.verified,
        service_latitude=body.service_latitude,
        service_longitude=body.service_longitude,
        service_radius_km=body.service_radius_km,
    )
    db.add(ngo)
    record_audit(
        db, action="ngo.create", actor_id=admin.id,
        entity_type="ngo", entity_id=str(ngo.id), ip_address=client_ip(request),
    )
    db.commit()
    db.refresh(ngo)
    return AdminNgoOut.model_validate(ngo)


# --- Volunteer approval ---

@router.get("/volunteers", response_model=list[AdminVolunteerOut])
def list_volunteers(
    pending_only: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[AdminVolunteerOut]:
    stmt = select(Volunteer).order_by(Volunteer.created_at.desc())
    if pending_only:
        stmt = stmt.where(Volunteer.status == VolunteerStatus.PENDING)
    return [_admin_volunteer_out(v) for v in db.scalars(stmt).all()]


@router.post("/volunteers/{volunteer_id}/approve", response_model=AdminVolunteerOut)
def approve_volunteer(
    request: Request,
    volunteer_id: uuid.UUID,
    approve: bool = Query(...),
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AdminVolunteerOut:
    """Approve (ACTIVE) or reject (INACTIVE) a pending volunteer application."""
    vol = db.get(Volunteer, volunteer_id)
    if not vol:
        raise NotFoundError("Volunteer not found")
    vol.status = VolunteerStatus.ACTIVE if approve else VolunteerStatus.INACTIVE
    # Approved volunteers default to available; rejected ones cannot be picked up.
    vol.is_available = approve
    record_audit(
        db, action="volunteer.approve" if approve else "volunteer.reject",
        actor_id=admin.id, entity_type="volunteer", entity_id=str(vol.id),
        ip_address=client_ip(request),
    )
    if vol.user:
        notify(
            db, user_id=vol.user_id,
            title="Volunteer application " + ("approved" if approve else "declined"),
            body=(
                "Welcome aboard! You can now accept rescue assignments."
                if approve
                else "Your volunteer application was not approved at this time."
            ),
            type_=NotificationType.SUCCESS if approve else NotificationType.WARNING,
        )
        if approve and vol.user.email:
            queue_email(
                vol.user.email,
                email_templates.volunteer_approved(vol.user.full_name or "there"),
            )
    db.commit()
    db.refresh(vol)
    return _admin_volunteer_out(vol)


# --- User management ---

@router.get("/users", response_model=PaginatedUsers)
def list_users(
    search: str | None = Query(default=None, max_length=200),
    role: UserRole | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedUsers:
    stmt = select(User).order_by(User.created_at.desc())
    if role:
        stmt = stmt.where(User.role == role)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(term), User.email.ilike(term)))
    rows = list(db.scalars(stmt).all())
    total = len(rows)
    start = (page - 1) * page_size
    return PaginatedUsers(
        items=[AdminUserOut.model_validate(u) for u in rows[start : start + page_size]],
        total=total, page=page, page_size=page_size, pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/users/{user_id}/suspend", response_model=AdminUserOut)
def set_user_active(
    request: Request,
    user_id: uuid.UUID,
    active: bool = Query(...),
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AdminUserOut:
    target = db.get(User, user_id)
    if not target:
        raise NotFoundError("User not found")
    if target.id == admin.id:
        raise ValidationError("You cannot change your own account status", code="self_action")
    target.is_active = active
    record_audit(
        db, action="user.activate" if active else "user.suspend", actor_id=admin.id,
        entity_type="user", entity_id=str(target.id), ip_address=client_ip(request),
    )
    db.commit()
    db.refresh(target)
    return AdminUserOut.model_validate(target)


# --- Report administration ---

@router.post("/reports/{report_id}/force-close", response_model=MessageResponse)
def force_close(
    request: Request,
    report_id: uuid.UUID,
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> MessageResponse:
    report = db.get(Report, report_id)
    if not report:
        raise NotFoundError("Report not found")
    report.status = ReportStatus.CLOSED
    report.closed_at = datetime.now(timezone.utc)
    record_audit(
        db, action="report.force_close", actor_id=admin.id,
        entity_type="report", entity_id=str(report.id), ip_address=client_ip(request),
    )
    db.commit()
    return MessageResponse(message="Report force-closed")


# --- Announcements ---

@router.get("/announcements", response_model=list[AnnouncementOut])
def list_announcements(db: Session = Depends(get_db)) -> list[AnnouncementOut]:
    stmt = select(Announcement).order_by(Announcement.pinned.desc(), Announcement.created_at.desc())
    return [AnnouncementOut.model_validate(a) for a in db.scalars(stmt).all()]


@router.post("/announcements", response_model=AnnouncementOut, status_code=201)
def create_announcement(
    body: AnnouncementCreate,
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> AnnouncementOut:
    ann = Announcement(
        author_id=admin.id, title=body.title, body=body.body,
        audience=body.audience, pinned=body.pinned, published=True,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    # Broadcast to connected clients in real time.
    bus.broadcast("announcement", {"title": ann.title, "body": ann.body, "audience": ann.audience.value})
    return AnnouncementOut.model_validate(ann)


@router.delete("/announcements/{announcement_id}", response_model=MessageResponse)
def delete_announcement(
    announcement_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> MessageResponse:
    ann = db.get(Announcement, announcement_id)
    if not ann:
        raise NotFoundError("Announcement not found")
    db.delete(ann)
    db.commit()
    return MessageResponse(message="Announcement deleted")


# --- Audit logs ---

@router.get("/audit-logs", response_model=PaginatedAuditLogs)
def audit_logs(
    action: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaginatedAuditLogs:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action}%"))
    rows = list(db.scalars(stmt).all())
    total = len(rows)
    start = (page - 1) * page_size
    return PaginatedAuditLogs(
        items=[AuditLogOut.model_validate(a) for a in rows[start : start + page_size]],
        total=total, page=page, page_size=page_size, pages=max(1, math.ceil(total / page_size)),
    )
