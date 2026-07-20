"""Authorized file delivery.

Stored objects (report photographs, case attachments including medical
documents, NGO logos, volunteer avatars) used to be served by a static mount at
``/uploads``. That made every byte permanently world-readable to anyone who
learned a URL: authorization was enforced on the metadata endpoints but never
on the bytes those endpoints pointed at.

Everything now flows through this one endpoint, which re-derives the owning
record from the storage key and applies the *same* ownership rules the metadata
endpoints apply. See ``_case_detail`` in ``app/api/v1/ngo/reports.py`` for the
case-access model this mirrors, and ``app/api/vol_deps.py`` for volunteer
scoping.
"""

from __future__ import annotations

import mimetypes

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.ngo_deps import is_admin
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.case_attachment import CaseAttachment
from app.models.enums import AssignmentStatus, UserRole
from app.models.ngo import NGO
from app.models.report import Report
from app.models.report_image import ReportImage
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.volunteer_assignment import VolunteerAssignment
from app.repositories.ngo import NgoRepository, VolunteerRepository
from app.services.geo_utils import haversine_km
from app.services.storage import StorageBackend, get_storage

router = APIRouter(prefix="/files", tags=["files"])


def _not_found() -> NotFoundError:
    """A key with no stored record gets a 404 regardless of who is asking, so
    the endpoint can't be used to probe which keys exist."""
    return NotFoundError("File not found", code="file_not_found")


def _owned_ngo(db: Session, user: User) -> NGO | None:
    return NgoRepository(db).get_by_owner(user.id)


def _volunteer_has_assignment(db: Session, vol: Volunteer, report_id) -> bool:
    """True if this volunteer is (or was) dispatched to the case.

    Mirrors the scoping in ``VolService._load_assignment``: a volunteer only
    reaches a case through an assignment addressed to them. A DECLINED or
    REMOVED assignment no longer grants access to the case's files.
    """
    stmt = select(VolunteerAssignment.id).where(
        VolunteerAssignment.volunteer_id == vol.id,
        VolunteerAssignment.report_id == report_id,
        VolunteerAssignment.status.not_in(
            (AssignmentStatus.DECLINED, AssignmentStatus.REMOVED)
        ),
    )
    return db.scalars(stmt).first() is not None


def _authorize_report_file(db: Session, user: User, report: Report) -> None:
    """Enforce case access for a file belonging to `report`.

    Mirrors ``_case_detail``:
      - admin: full oversight, any case;
      - the claiming NGO: owns the case;
      - another NGO: 403 (``not_your_case``);
      - unclaimed case: only a VERIFIED NGO whose service area covers it, so
        file access cannot bypass discovery's radius scoping;
      - assigned volunteer: their own dispatched case only;
      - the reporter who filed it while logged in.
    """
    if is_admin(user):
        return

    if user.role is UserRole.NGO:
        ngo = _owned_ngo(db, user)
        if ngo is None:
            raise ForbiddenError("NGO access required", code="ngo_role_required")
        if report.claimed_by_ngo_id == ngo.id:
            return
        if report.claimed_by_ngo_id:
            raise ForbiddenError(
                "This case belongs to another organization", code="not_your_case"
            )
        if not ngo.is_verified:
            raise ForbiddenError(
                "Your organization must be verified to view case details",
                code="ngo_not_verified",
            )
        dist = None
        if ngo.service_latitude is not None and report.latitude is not None:
            dist = haversine_km(
                ngo.service_latitude, ngo.service_longitude,
                report.latitude, report.longitude,
            )
        if dist is None or dist > ngo.service_radius_km:
            raise ForbiddenError(
                "This case is outside your service area", code="out_of_area"
            )
        return

    if user.role is UserRole.VOLUNTEER:
        vol = VolunteerRepository(db).get_by_user(user.id)
        if vol is not None and _volunteer_has_assignment(db, vol, report.id):
            return
        raise ForbiddenError(
            "This case is not assigned to you", code="not_your_case"
        )

    # Citizen: only their own report, and only if they filed it signed in.
    if report.reporter_id is not None and report.reporter_id == user.id:
        return

    raise ForbiddenError("You cannot access this file", code="file_forbidden")


def _resolve(db: Session, user: User, key: str) -> str | None:
    """Authorize `key` for `user` and return its stored content type.

    Raises NotFoundError if no record owns the key. Raises ForbiddenError if a
    record owns it but the caller may not read it.
    """
    att = db.scalars(
        select(CaseAttachment).where(CaseAttachment.storage_key == key)
    ).first()
    if att is not None:
        report = db.get(Report, att.report_id)
        if report is None:
            raise _not_found()
        _authorize_report_file(db, user, report)
        return att.content_type

    img = db.scalars(
        select(ReportImage).where(ReportImage.storage_key == key)
    ).first()
    if img is not None:
        report = db.get(Report, img.report_id)
        if report is None:
            raise _not_found()
        _authorize_report_file(db, user, report)
        return img.content_type

    # NGO logos are the organization's public identity: shown wherever an NGO
    # is named, so any signed-in user may read one.
    ngo = db.scalars(select(NGO).where(NGO.logo_key == key)).first()
    if ngo is not None:
        return None

    # A volunteer's avatar is personal; only they and an admin see it (it is
    # not surfaced on any NGO-facing view).
    vol = db.scalars(select(Volunteer).where(Volunteer.avatar_key == key)).first()
    if vol is not None:
        if is_admin(user) or vol.user_id == user.id:
            return None
        raise ForbiddenError("You cannot access this file", code="file_forbidden")

    raise _not_found()


@router.get("/{key:path}")
def get_file(
    key: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> Response:
    """Serve a stored object to a caller entitled to the record that owns it."""
    content_type = _resolve(db, user, key)

    try:
        data = storage.open(key)
    except (FileNotFoundError, OSError, ValueError) as exc:
        # Row exists but the object doesn't (or the key is malformed and the
        # backend rejected it): same 404 as an unknown key.
        raise _not_found() from exc

    if not content_type:
        content_type = mimetypes.guess_type(key)[0] or "application/octet-stream"

    headers = {
        # Personal data: never cached by a shared proxy, never written to disk.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    }
    if not content_type.startswith("image/"):
        # A PDF (or Office doc) rendered inline runs on the API origin, where a
        # session cookie or a same-origin fetch would be in scope. Force the
        # download path for everything that isn't a plain image.
        headers["Content-Disposition"] = "attachment"

    return Response(content=data, media_type=content_type, headers=headers)
