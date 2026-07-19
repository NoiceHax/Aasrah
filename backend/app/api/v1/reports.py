"""Report endpoints: create, upload images, fetch by tracking ID / by ID."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_user, require_roles
from app.core.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.report import Report
from app.models.user import User
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
@limiter.limit("30/minute")
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
    # Signal live dashboards to refresh. Content-free by design: no report
    # details are leaked to connected clients; just "something changed", which
    # triggers a refetch through the client's own authorized queries.
    bus.broadcast(
        "report_created",
        {
            "tracking_id": report.tracking_id,
            "priority": report.priority.value,
            "situation": report.situation.value,
        },
    )
    # Email the reporter a confirmation with their tracking ID (if we can reach them).
    if user and user.email:
        queue_email(user.email, email_templates.report_confirmation(report.tracking_id))
    return ReportCreateResponse(
        tracking_id=report.tracking_id,
        status=report.status,
        created_at=report.created_at,
        report_id=report.id,
    )


@router.post("/{report_id}/images", response_model=ReportOut)
@limiter.limit("30/minute")
async def upload_images(
    request: Request,
    report_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> ReportOut:
    service = _service(db, storage)
    report = service.repo.get_with_images(report_id)
    if not report:
        raise NotFoundError("Report not found")

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
def track_report(
    tracking_id: str,
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> ReportTrackingOut:
    """Public tracking lookup: no authentication, no sensitive contact details."""
    service = _service(db, storage)
    report = service.repo.get_by_tracking_id(tracking_id)
    if not report:
        raise NotFoundError("No report found with that tracking ID")
    return ReportTrackingOut(
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
        timeline=service.build_timeline(report),
    )


@router.get("/{report_id}", response_model=ReportOut)
def get_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
    user: User = Depends(require_roles(UserRole.NGO, UserRole.ADMIN, UserRole.VOLUNTEER)),
) -> ReportOut:
    """Fetch a full report by internal ID. Restricted to staff roles."""
    service = _service(db, storage)
    report = service.repo.get_with_images(report_id)
    if not report:
        raise NotFoundError("Report not found")
    return _report_out(report, storage)
