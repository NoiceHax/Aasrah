"""NGO report discovery, claim, case detail, and status transitions."""

import math
import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import client_ip, get_current_user
from app.api.ngo_deps import (
    get_current_ngo,
    get_verified_ngo,
    is_admin,
    resolve_acting_ngo_for_report,
)
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.enums import ReportStatus
from app.models.ngo import NGO
from app.models.report import Report
from app.models.user import User
from app.schemas.report import (
    CaseDetailOut,
    CaseTimelineItem,
    NgoReportListItem,
    PaginatedReports,
    ReportImageOut,
    StatusUpdateRequest,
)
from app.services.geo_utils import haversine_km
from app.services.ngo_reports import DiscoveryFilters, NgoReportService
from app.services.storage import StorageBackend, get_storage

router = APIRouter(prefix="/ngo/reports", tags=["ngo:reports"])


def _list_item(report: Report, distance_km: float | None, ngo_name: str | None) -> NgoReportListItem:
    return NgoReportListItem(
        id=report.id,
        tracking_id=report.tracking_id,
        situation=report.situation,
        priority=report.priority,
        status=report.status,
        address=report.address,
        latitude=report.latitude,
        longitude=report.longitude,
        children_present=report.children_present,
        people_count=report.people_count,
        distance_km=round(distance_km, 2) if distance_km is not None else None,
        claimed_by_ngo_id=report.claimed_by_ngo_id,
        claimed_by_name=ngo_name,
        image_count=len(report.images),
        created_at=report.created_at,
    )


@router.get("/nearby", response_model=PaginatedReports)
def discover_nearby(
    request: Request,
    status: ReportStatus | None = Query(default=None),
    max_distance_km: float | None = Query(default=None, gt=0, le=500),
    since_hours: int | None = Query(default=None, gt=0, le=720),
    children_only: bool = Query(default=False),
    medical_only: bool = Query(default=False),
    search: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    # Verified-only, to match the case-detail view: an unverified NGO must not
    # be able to enumerate nearby reports via the list when it cannot open them.
    ngo: NGO = Depends(get_verified_ngo),
    db: Session = Depends(get_db),
) -> PaginatedReports:
    service = NgoReportService(db)
    filters = DiscoveryFilters(
        status=status,
        max_distance_km=max_distance_km,
        since_hours=since_hours,
        children_only=children_only,
        medical_only=medical_only,
        search=search,
        page=page,
        page_size=page_size,
    )
    items, total = service.discover(ngo, filters)
    return PaginatedReports(
        items=[_list_item(r, d, ngo.name if r.claimed_by_ngo_id == ngo.id else None) for r, d in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/claimed", response_model=PaginatedReports)
def list_claimed(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: ReportStatus | None = Query(default=None),
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
) -> PaginatedReports:
    stmt = (
        select(Report)
        .where(Report.claimed_by_ngo_id == ngo.id)
        .options(selectinload(Report.images))
        .order_by(Report.updated_at.desc())
    )
    if status:
        stmt = stmt.where(Report.status == status)
    all_rows = list(db.scalars(stmt).all())
    total = len(all_rows)
    start = (page - 1) * page_size
    rows = all_rows[start : start + page_size]

    items = []
    for r in rows:
        dist = None
        if ngo.service_latitude is not None and r.latitude is not None:
            dist = haversine_km(ngo.service_latitude, ngo.service_longitude, r.latitude, r.longitude)
        items.append(_list_item(r, dist, ngo.name))
    return PaginatedReports(
        items=items, total=total, page=page, page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/{report_id}/claim", response_model=CaseDetailOut)
def claim_report(
    request: Request,
    report_id: uuid.UUID,
    ngo: NGO = Depends(get_verified_ngo),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> CaseDetailOut:
    service = NgoReportService(db)
    service.claim(ngo, report_id, actor_id=user.id, ip=client_ip(request))
    db.commit()
    return _case_detail(db, storage, ngo, report_id)


@router.patch("/{report_id}/status", response_model=CaseDetailOut)
def update_status(
    request: Request,
    report_id: uuid.UUID,
    body: StatusUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> CaseDetailOut:
    # Resolve the NGO the user acts as for this case (own NGO, or, for an
    # admin, the case's owning NGO). Admins can only progress a claimed case.
    report = db.get(Report, report_id)
    if not report:
        raise NotFoundError("Case not found")
    ngo = resolve_acting_ngo_for_report(db, user, report)
    service = NgoReportService(db)
    service.update_status(
        ngo, report_id, body.status, actor_id=user.id, ip=client_ip(request), note=body.note
    )
    db.commit()
    return _case_detail(db, storage, ngo, report_id, user=user)


@router.get("/{report_id}", response_model=CaseDetailOut)
def get_case(
    report_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> CaseDetailOut:
    # Admins get read access to any case; NGOs use their own org (subject to the
    # ownership / service-area rules in _case_detail).
    if is_admin(user):
        ngo = None
    else:
        ngo = get_current_ngo(user=user, db=db)
    return _case_detail(db, storage, ngo, report_id, user=user)


def _case_detail(
    db: Session,
    storage: StorageBackend,
    ngo: NGO | None,
    report_id: uuid.UUID,
    *,
    user: User | None = None,
) -> CaseDetailOut:
    report = db.scalars(
        select(Report)
        .where(Report.id == report_id)
        .options(selectinload(Report.images), selectinload(Report.timeline_events))
    ).first()
    if not report:
        raise NotFoundError("Case not found")

    admin = user is not None and is_admin(user)
    # Admins have full oversight (they see reporter PII and any case). NGO users
    # own a case only when it's claimed by their org.
    is_owner = admin or (ngo is not None and report.claimed_by_ngo_id == ngo.id)

    dist = None
    if ngo is not None and ngo.service_latitude is not None and report.latitude is not None:
        dist = round(
            haversine_km(ngo.service_latitude, ngo.service_longitude, report.latitude, report.longitude),
            2,
        )

    # Authorization (admins bypass, platform oversight):
    # - Claimed by another NGO → forbidden.
    # - Claimed by us → full access (we own the case).
    # - Unclaimed → only viewable by a VERIFIED NGO whose service area covers it
    #   (mirrors discovery's radius filter so detail can't bypass area scoping).
    if not admin:
        if report.claimed_by_ngo_id and not is_owner:
            raise ForbiddenError("This case belongs to another organization", code="not_your_case")
        if not is_owner:
            if ngo is None or not ngo.is_verified:
                raise ForbiddenError(
                    "Your organization must be verified to view case details",
                    code="ngo_not_verified",
                )
            if dist is None or dist > ngo.service_radius_km:
                raise ForbiddenError("This case is outside your service area", code="out_of_area")

    # Reporter contact PII is only exposed to the claiming NGO, never on a
    # discovery/preview view of an unclaimed report.
    return CaseDetailOut(
        id=report.id,
        tracking_id=report.tracking_id,
        situation=report.situation,
        priority=report.priority,
        status=report.status,
        description=report.description,
        address=report.address,
        latitude=report.latitude,
        longitude=report.longitude,
        children_present=report.children_present,
        people_count=report.people_count,
        reporter_name=report.reporter_name if is_owner else None,
        reporter_phone=report.reporter_phone if is_owner else None,
        distance_km=dist,
        claimed_by_ngo_id=report.claimed_by_ngo_id,
        claimed_at=report.claimed_at,
        closed_at=report.closed_at,
        created_at=report.created_at,
        updated_at=report.updated_at,
        images=[
            ReportImageOut(
                id=i.id, url=storage.url_for(i.storage_key),
                width=i.width, height=i.height, position=i.position,
            )
            for i in report.images
        ],
        timeline=[
            CaseTimelineItem(
                id=e.id, event_type=e.event_type, title=e.title,
                description=e.description, actor_id=e.actor_id,
                is_public=e.is_public, created_at=e.created_at,
            )
            for e in report.timeline_events
        ],
        ai_summary=report.ai_summary,
        ai_analysis=report.ai_analysis,
        priority_score=report.priority_score,
        priority_auto=report.priority_auto,
        duplicate_of_id=report.duplicate_of_id,
    )
