"""Report endpoints: create, upload images, fetch by tracking ID / by ID."""

import uuid
from typing import List, Optional

import jwt
from fastapi import APIRouter, Depends, File, Header, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_user, require_roles
from app.core.config import settings
from app.core.exceptions import AuthError, ForbiddenError, NotFoundError, ValidationError
from app.core.rate_limit import limiter
from app.core.security import create_upload_token, decode_token
from app.db.session import get_db
from app.models.enums import AssignmentStatus, ReportStatus, UserRole
from app.models.report import Report
from app.models.user import User
from app.models.volunteer_assignment import VolunteerAssignment
from app.repositories.ngo import NgoRepository, VolunteerRepository
from app.services.geo_utils import haversine_km
from app.schemas.report import (
    ReportCreate,
    ReportCreateResponse,
    ReportImageOut,
    ReportOut,
    ReportTrackingOut,
)
from app.services.reports import ReportService
from app.services.email import templates as email_templates
from app.services.email.sender import queue_email
from app.services.jobs import runner
from app.services.realtime import bus
from app.services.report_ai import process_report
from app.services.storage import StorageBackend, get_storage
from app.services.tracking import coarse_locality
from app.services.uploads import read_limited

router = APIRouter(prefix="/reports", tags=["reports"])


def _service(db: Session, storage: StorageBackend) -> ReportService:
    return ReportService(db, storage)


def _image_out(report: Report, storage: StorageBackend) -> list[ReportImageOut]:
    return [
        ReportImageOut(
            id=img.id,
            url=storage.url_for(img.storage_key),
            width=img.width,
            height=img.height,
            position=img.position,
        )
        for img in report.images
    ]


def _report_out(report: Report, storage: StorageBackend) -> ReportOut:
    # Build from explicit fields rather than model_validate(report): the ORM's
    # `images` are ReportImage rows (storage_key, no `url`), so validating the
    # relationship directly would fail. We map images via the storage backend.
    return ReportOut(
        id=report.id,
        tracking_id=report.tracking_id,
        situation=report.situation,
        priority=report.priority,
        status=report.status,
        description=report.description,
        address=report.address,
        latitude=report.latitude,
        longitude=report.longitude,
        created_at=report.created_at,
        updated_at=report.updated_at,
        images=_image_out(report, storage),
    )


@router.post("", response_model=ReportCreateResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_REPORT_CREATE)
def create_report(
    request: Request,
    body: ReportCreate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    storage: StorageBackend = Depends(get_storage),
) -> ReportCreateResponse:
    """Create a report (anonymous or authenticated). Images are uploaded separately."""
    service = _service(db, storage)
    report = service.create(body, reporter=user)
    db.commit()
    db.refresh(report)
    # Generate AI summary + priority off the request path.
    runner.enqueue("report.process", process_report, str(report.id))
    # Signal live dashboards to refresh. Content-free by design: the payload
    # carries no report details at all, just "something changed", which
    # triggers a refetch through the client's own authorized queries.
    #
    # This previously carried the tracking_id and was sent via broadcast(), so
    # any authenticated socket — including a self-registered, unapproved
    # volunteer — received the tracking ID of every report on the platform,
    # each of which resolved to a person's location via the public track
    # endpoint. Both halves of that are now closed: empty payload, and the
    # audience is limited to staff who can act on a new report.
    bus.publish_to_roles(
        (UserRole.NGO.value, UserRole.ADMIN.value),
        "report_created",
        {},
    )
    # Email the reporter a confirmation with their tracking ID (if we can reach them).
    if user and user.email:
        queue_email(user.email, email_templates.report_confirmation(report.tracking_id))
    return ReportCreateResponse(
        tracking_id=report.tracking_id,
        status=report.status,
        created_at=report.created_at,
        report_id=report.id,
        upload_token=create_upload_token(str(report.id)),
    )


def _authorize_upload(
    report: Report, upload_token: str | None, user: User | None
) -> None:
    """Allow an image upload only from someone entitled to add to this report.

    Three ways in, in order of how they arise:
      1. the short-lived upload token issued when the report was created
         (the anonymous reporter, still on the success screen);
      2. the authenticated reporter, if they filed it while logged in;
      3. an admin, for support cases.

    Without this the endpoint was fully open: anyone holding a report UUID
    could attach arbitrary images, which is both unbounded storage abuse on an
    NGO's infrastructure and a way to plant fabricated evidence on a live case.
    """
    if upload_token:
        try:
            payload = decode_token(upload_token)
            if payload.get("type") == "upload" and payload.get("sub") == str(report.id):
                return
        except jwt.PyJWTError:
            pass
        raise AuthError("Upload link is invalid or has expired", code="invalid_upload_token")

    if user is not None and (
        user.role is UserRole.ADMIN
        or (report.reporter_id is not None and report.reporter_id == user.id)
    ):
        return

    raise AuthError("Not authorized to add images to this report", code="upload_not_authorized")


@router.post("/{report_id}/images", response_model=ReportOut)
@limiter.limit(settings.RATE_LIMIT_UPLOAD)
async def upload_images(
    request: Request,
    report_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    upload_token: Optional[str] = Header(default=None, alias="X-Upload-Token"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    storage: StorageBackend = Depends(get_storage),
) -> ReportOut:
    service = _service(db, storage)
    report = service.repo.get_with_images(report_id)
    if not report:
        raise NotFoundError("Report not found")

    _authorize_upload(report, upload_token, user)

    # Images belong to the initial filing. Once an NGO has picked the case up,
    # the case-attachment flow (with its own ownership checks) takes over.
    if report.status is not ReportStatus.PENDING:
        raise ValidationError(
            "This report is already being handled and can no longer accept new photos.",
            code="report_not_pending",
        )

    if not files:
        raise ValidationError("No files provided", code="no_files")

    remaining = settings.MAX_IMAGES_PER_REPORT - len(report.images)
    if len(files) > remaining:
        raise ValidationError(
            f"Too many images. This report can accept {max(remaining, 0)} more "
            f"(max {settings.MAX_IMAGES_PER_REPORT} total).",
            code="too_many_images",
        )

    payloads: list[tuple[bytes, str | None]] = []
    for f in files:
        raw = await read_limited(f)
        if not raw:
            raise ValidationError(f"Empty file: {f.filename}", code="empty_file")
        payloads.append((raw, f.filename))

    service.attach_images(report, payloads)
    db.commit()
    db.refresh(report)
    # Re-run analysis now that the report has image(s) for vision.
    runner.enqueue("report.process", process_report, str(report.id))
    return _report_out(report, storage)


@router.get("/track/{tracking_id}", response_model=ReportTrackingOut)
@limiter.limit(settings.RATE_LIMIT_TRACK)
def track_report(
    request: Request,
    tracking_id: str,
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> ReportTrackingOut:
    """Public tracking lookup: progress only, no case content.

    Rate-limited because it is unauthenticated and takes a 6-character ID from
    a 31-character alphabet: without a limit the whole keyspace is walkable,
    and a 404 is distinguishable from a hit. See ReportTrackingOut for what is
    deliberately withheld.
    """
    service = _service(db, storage)
    report = service.repo.get_by_tracking_id(tracking_id)
    if not report:
        raise NotFoundError("No report found with that tracking ID")
    return ReportTrackingOut(
        tracking_id=report.tracking_id,
        situation=report.situation,
        priority=report.priority,
        status=report.status,
        locality=coarse_locality(report.address),
        created_at=report.created_at,
        updated_at=report.updated_at,
        timeline=service.build_timeline(report),
    )


def _authorize_report_read(db: Session, user: User, report: Report) -> None:
    """Per-record scoping for the by-ID report read.

    Holding a staff *role* is not authorization to read an arbitrary case:
    self-registered volunteers start out PENDING with the VOLUNTEER role, so
    the role check alone let anyone with a report UUID pull description,
    address, exact coordinates and image URLs.

      - ADMIN: unrestricted (platform oversight).
      - VOLUNTEER: only a report they hold a live assignment on.
      - NGO: only a case their org owns, or an unclaimed one inside their
        service area — mirroring `_case_detail`'s rules.
    """
    if user.role is UserRole.ADMIN:
        return

    if user.role is UserRole.VOLUNTEER:
        vol = VolunteerRepository(db).get_by_user(user.id)
        if vol is None:
            raise ForbiddenError("Not authorized to view this report", code="report_not_visible")
        active = db.scalars(
            select(VolunteerAssignment).where(
                VolunteerAssignment.report_id == report.id,
                VolunteerAssignment.volunteer_id == vol.id,
                VolunteerAssignment.status.not_in(
                    (AssignmentStatus.DECLINED, AssignmentStatus.REMOVED)
                ),
            )
        ).first()
        if active is None:
            raise ForbiddenError(
                "You are not assigned to this case", code="not_assigned_to_case"
            )
        return

    # NGO role.
    ngo = NgoRepository(db).get_by_owner(user.id)
    if ngo is None:
        raise ForbiddenError("Not authorized to view this report", code="report_not_visible")
    if report.claimed_by_ngo_id == ngo.id:
        return
    if report.claimed_by_ngo_id is not None:
        raise ForbiddenError("This case belongs to another organization", code="not_your_case")
    if not ngo.is_verified:
        raise ForbiddenError(
            "Your organization must be verified to view case details",
            code="ngo_not_verified",
        )
    if (
        ngo.service_latitude is None
        or ngo.service_longitude is None
        or report.latitude is None
        or report.longitude is None
        or haversine_km(
            ngo.service_latitude, ngo.service_longitude, report.latitude, report.longitude
        )
        > ngo.service_radius_km
    ):
        raise ForbiddenError("This case is outside your service area", code="out_of_area")


@router.get("/{report_id}", response_model=ReportOut)
def get_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
    user: User = Depends(require_roles(UserRole.NGO, UserRole.ADMIN, UserRole.VOLUNTEER)),
) -> ReportOut:
    """Fetch a full report by internal ID. Restricted to staff roles *and*
    scoped per-record to the caller's actual relationship with the case."""
    service = _service(db, storage)
    report = service.repo.get_with_images(report_id)
    if not report:
        raise NotFoundError("Report not found")
    _authorize_report_read(db, user, report)
    return _report_out(report, storage)
