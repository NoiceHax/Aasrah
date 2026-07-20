"""Data-subject rights: self-service export (access) and erasure.

The privacy notice promises every account holder the right to obtain a copy of
their personal data and to have it erased. These two endpoints are how that
promise is actually kept; without them it is a claim the product cannot honour.

Both act only on the caller's own data, identified by the bearer token -- there
is no id parameter to tamper with, so there is no IDOR surface here.
"""

# NOTE: deliberately no `from __future__ import annotations` in this module.
# The rate-limit decorator wraps the handler, so FastAPI resolves its string
# annotations against the decorator's module globals instead of this one; the
# request-body model then fails to resolve and FastAPI silently downgrades it
# to a query parameter (every call 422s). Real annotation objects avoid that.

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.api.deps import client_ip, get_current_user
from app.core.config import settings
from app.core.exceptions import AuthError
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.core.security import verify_password
from app.db.session import get_db
from app.models.announcement import Announcement
from app.models.audit_log import AuditLog
from app.models.case_attachment import CaseAttachment
from app.models.case_timeline import CaseTimelineEvent
from app.models.entity_version import EntityVersion
from app.models.internal_note import InternalNote
from app.models.ngo import NGO
from app.models.notification import Notification
from app.models.push_subscription import PushSubscription
from app.models.report import Report
from app.models.session import Session as AuthSession
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.volunteer_assignment import VolunteerAssignment
from app.schemas.auth import MessageResponse
from app.schemas.notification import NotificationOut
from app.schemas.report import ReportOut
from app.schemas.user import UserOut
from app.services.audit import record_audit

router = APIRouter(prefix="/me", tags=["me"])
logger = get_logger(__name__)


# --- Schemas ------------------------------------------------------------------

class PushSubscriptionExport(BaseModel):
    """A registered browser push endpoint.

    The `p256dh`/`auth` key material is deliberately omitted: it is a sending
    credential for that endpoint, not information about the subject, and an
    export file is a far likelier thing to leak than the database.
    """

    endpoint: str
    created_at: datetime


class VolunteerProfileExport(BaseModel):
    id: uuid.UUID
    ngo_id: uuid.UUID | None
    assignment_mode: str
    status: str
    role_title: str | None
    availability: str | None
    phone: str | None
    skills: list[str] = []
    certifications: list[str] = []
    languages: list[str] = []
    emergency_contact: str | None
    is_available: bool
    working_radius_km: float | None
    schedule: str | None
    latitude: float | None
    longitude: float | None
    completed_rescues: int
    total_hours: float
    rating: float | None
    created_at: datetime


class MeExport(BaseModel):
    """Everything the platform holds that is linked to this account."""

    exported_at: datetime
    account: UserOut
    volunteer_profile: VolunteerProfileExport | None = None
    reports: list[ReportOut] = []
    notifications: list[NotificationOut] = []
    push_subscriptions: list[PushSubscriptionExport] = []


class DeleteMeRequest(BaseModel):
    # Re-authentication: an access token is enough to read, but not to destroy.
    # A leaked or borrowed token must not be able to wipe an account on its own.
    password: str = Field(min_length=1, max_length=128)


def _csv(value: str | None) -> list[str]:
    return [part.strip() for part in (value or "").split(",") if part.strip()]


# --- Access -------------------------------------------------------------------

@router.get("/export", response_model=MeExport)
def export_my_data(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeExport:
    """Return the caller's own personal data as JSON (right of access)."""
    volunteer = db.scalars(select(Volunteer).where(Volunteer.user_id == user.id)).first()
    reports = db.scalars(
        select(Report)
        .where(Report.reporter_id == user.id)
        .options(selectinload(Report.images))
        .order_by(Report.created_at.desc())
    ).all()
    notifications = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
    ).all()
    subscriptions = db.scalars(
        select(PushSubscription).where(PushSubscription.user_id == user.id)
    ).all()

    profile = None
    if volunteer:
        profile = VolunteerProfileExport(
            id=volunteer.id,
            ngo_id=volunteer.ngo_id,
            assignment_mode=volunteer.assignment_mode.value,
            status=volunteer.status.value,
            role_title=volunteer.role_title,
            availability=volunteer.availability,
            phone=volunteer.phone,
            skills=_csv(volunteer.skills),
            certifications=_csv(volunteer.certifications),
            languages=_csv(volunteer.languages),
            emergency_contact=volunteer.emergency_contact,
            is_available=volunteer.is_available,
            working_radius_km=volunteer.working_radius_km,
            schedule=volunteer.schedule,
            latitude=volunteer.latitude,
            longitude=volunteer.longitude,
            completed_rescues=volunteer.completed_rescues,
            total_hours=volunteer.total_hours,
            rating=volunteer.rating,
            created_at=volunteer.created_at,
        )

    return MeExport(
        exported_at=datetime.now(timezone.utc),
        account=UserOut.model_validate(user),
        volunteer_profile=profile,
        reports=[ReportOut.model_validate(r) for r in reports],
        notifications=[NotificationOut.model_validate(n) for n in notifications],
        push_subscriptions=[
            PushSubscriptionExport(endpoint=s.endpoint, created_at=s.created_at)
            for s in subscriptions
        ],
    )


# --- Erasure ------------------------------------------------------------------

@router.delete("", response_model=MessageResponse, status_code=status.HTTP_200_OK)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def delete_my_account(
    request: Request,
    body: DeleteMeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Erase the caller's account (right to erasure).

    What goes, what stays, and why:

    * Gone: the account row, the volunteer profile, every session (so all
      refresh tokens die with it), push subscriptions, and notifications.
    * Stays, de-identified: reports the user filed, and every record of an
      action they took as staff -- audit logs, case timeline events, entity
      versions, internal notes, case attachments, assignments they made,
      announcements they wrote. Those describe what happened to *other* people's
      cases; erasing them would erase someone else's record, and the audit trail
      is the accountability backstop for a platform handling vulnerable people.
      Their link to this user is severed instead: the actor/author/reporter
      reference is set to NULL, which is exactly what the schema's
      `ON DELETE SET NULL` was chosen to do. We do it explicitly here rather
      than relying on the database so the outcome is identical on every backend
      and cannot be silently skipped where FK enforcement is off.
    * Scrubbed: the reporter name and phone denormalised onto their reports,
      which are free-text copies of this user's contact details and not needed
      to keep the case intact.

    Deleting the volunteer profile also removes that volunteer's assignment
    rows (`ON DELETE CASCADE`); the corresponding case timeline entries, which
    are the durable record of who was dispatched, survive.
    """
    if not verify_password(body.password, user.hashed_password):
        # Deliberately not "wrong password" vs "expired" -- one message, and no
        # partial destruction: nothing below runs unless this check passes.
        raise AuthError("Password is incorrect", code="invalid_password")

    user_id = user.id

    # 1. Record the erasure itself before the actor disappears. actor_id stays
    #    NULL: attributing the row to a user we are about to erase would defeat
    #    the point, while entity_id keeps the request auditable.
    record_audit(
        db,
        action="user.erased",
        actor_id=None,
        entity_type="user",
        entity_id=str(user_id),
        ip_address=client_ip(request),
        meta={"role": user.role.value, "self_service": True},
    )

    # 2. Sever actor references so accountability records survive un-attributed.
    for model, column in (
        (AuditLog, AuditLog.actor_id),
        (CaseTimelineEvent, CaseTimelineEvent.actor_id),
        (EntityVersion, EntityVersion.actor_id),
        (InternalNote, InternalNote.author_id),
        (CaseAttachment, CaseAttachment.uploaded_by_id),
        (Announcement, Announcement.author_id),
        (NGO, NGO.owner_id),
    ):
        db.execute(update(model).where(column == user_id).values({column.key: None}))

    db.execute(
        update(VolunteerAssignment)
        .where(VolunteerAssignment.assigned_by_id == user_id)
        .values(assigned_by_id=None)
    )

    # 3. Detach + scrub the reports they filed. The report stays (an NGO may be
    #    actively working the case); the reporter's identity does not.
    db.execute(
        update(Report)
        .where(Report.reporter_id == user_id)
        .values(reporter_id=None, reporter_name=None, reporter_phone=None)
    )

    # 4. Hard-delete everything that exists only to serve this user.
    volunteer = db.scalars(select(Volunteer).where(Volunteer.user_id == user_id)).first()
    if volunteer:
        db.delete(volunteer)  # cascades to their assignment rows
    for notification in db.scalars(
        select(Notification).where(Notification.user_id == user_id)
    ).all():
        db.delete(notification)
    for subscription in db.scalars(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    ).all():
        db.delete(subscription)
    for session_row in db.scalars(
        select(AuthSession).where(AuthSession.user_id == user_id)
    ).all():
        db.delete(session_row)

    db.flush()
    db.delete(user)
    db.commit()

    logger.info("Erased account %s on self-service request", user_id)
    return MessageResponse(message="Your account and personal data have been deleted.")
