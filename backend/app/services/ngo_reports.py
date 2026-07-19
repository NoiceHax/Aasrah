"""NGO report discovery, claiming, and case status transitions."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models.enums import NotificationType, ReportPriority, ReportStatus
from app.models.ngo import NGO
from app.models.report import Report
from app.models.report_image import ReportImage
from app.services.audit import add_timeline_event, notify, record_audit
from app.services.geo_utils import bounding_box, haversine_km
from app.services.versioning import snapshot

# Priority ordering for urgency sorting (lower = more urgent).
_PRIORITY_RANK = {
    ReportPriority.CRITICAL: 0,
    ReportPriority.HIGH: 1,
    ReportPriority.MEDIUM: 2,
    ReportPriority.STABLE: 3,
}

# Allowed rescue-workflow transitions. None of these may skip ahead arbitrarily.
_TRANSITIONS: dict[ReportStatus, set[ReportStatus]] = {
    ReportStatus.PENDING: {ReportStatus.CLAIMED, ReportStatus.VERIFIED, ReportStatus.REJECTED},
    ReportStatus.VERIFIED: {ReportStatus.CLAIMED, ReportStatus.REJECTED},
    ReportStatus.CLAIMED: {ReportStatus.VOLUNTEER_ASSIGNED, ReportStatus.REJECTED},
    ReportStatus.VOLUNTEER_ASSIGNED: {ReportStatus.VOLUNTEER_ACCEPTED, ReportStatus.CLAIMED},
    ReportStatus.VOLUNTEER_ACCEPTED: {ReportStatus.ON_ROUTE},
    ReportStatus.ON_ROUTE: {ReportStatus.REACHED_LOCATION},
    ReportStatus.REACHED_LOCATION: {ReportStatus.RESCUE_COMPLETED},
    ReportStatus.RESCUE_COMPLETED: {ReportStatus.SHELTER_ASSIGNED, ReportStatus.CLOSED},
    ReportStatus.SHELTER_ASSIGNED: {ReportStatus.CLOSED},
}

# Human-friendly labels for timeline events on status change.
_STATUS_LABELS: dict[ReportStatus, str] = {
    ReportStatus.VERIFIED: "Report Verified",
    ReportStatus.CLAIMED: "Claimed by NGO",
    ReportStatus.VOLUNTEER_ASSIGNED: "Volunteer Assigned",
    ReportStatus.VOLUNTEER_ACCEPTED: "Volunteer Accepted",
    ReportStatus.ON_ROUTE: "Responder On Route",
    ReportStatus.REACHED_LOCATION: "Reached Location",
    ReportStatus.RESCUE_COMPLETED: "Rescue Completed",
    ReportStatus.SHELTER_ASSIGNED: "Shelter Assigned",
    ReportStatus.CLOSED: "Case Closed",
    ReportStatus.REJECTED: "Report Rejected",
}


@dataclass
class DiscoveryFilters:
    status: ReportStatus | None = None
    max_distance_km: float | None = None
    since_hours: int | None = None
    children_only: bool = False
    medical_only: bool = False
    search: str | None = None
    page: int = 1
    page_size: int = 20


class NgoReportService:
    def __init__(self, db: Session):
        self.db = db

    # --- Discovery ---

    def discover(self, ngo: NGO, filters: DiscoveryFilters) -> tuple[list[tuple[Report, float | None]], int]:
        """Return (report, distance_km) tuples within the NGO service area, plus total count."""
        stmt = select(Report).options(selectinload(Report.images))

        # Geographic pre-filter via bounding box when the NGO has a service area.
        has_area = ngo.service_latitude is not None and ngo.service_longitude is not None
        radius = filters.max_distance_km or ngo.service_radius_km
        if has_area:
            min_lat, max_lat, min_lon, max_lon = bounding_box(
                ngo.service_latitude, ngo.service_longitude, radius
            )
            stmt = stmt.where(
                Report.latitude.is_not(None),
                Report.longitude.is_not(None),
                Report.latitude.between(min_lat, max_lat),
                Report.longitude.between(min_lon, max_lon),
            )

        if filters.status:
            stmt = stmt.where(Report.status == filters.status)
        if filters.children_only:
            stmt = stmt.where(Report.children_present.is_(True))
        if filters.medical_only:
            stmt = stmt.where(Report.situation == "medical")
        if filters.since_hours:
            cutoff = datetime.now(timezone.utc).timestamp() - filters.since_hours * 3600
            stmt = stmt.where(
                Report.created_at >= datetime.fromtimestamp(cutoff, tz=timezone.utc)
            )
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    Report.tracking_id.ilike(term),
                    Report.description.ilike(term),
                    Report.address.ilike(term),
                    Report.reporter_name.ilike(term),
                )
            )

        reports = list(self.db.scalars(stmt).all())

        # Exact distance filter + annotate.
        annotated: list[tuple[Report, float | None]] = []
        for r in reports:
            dist = None
            if has_area and r.latitude is not None and r.longitude is not None:
                dist = haversine_km(
                    ngo.service_latitude, ngo.service_longitude, r.latitude, r.longitude
                )
                if dist > radius:
                    continue
            annotated.append((r, dist))

        # Sort by urgency, then distance, then recency.
        annotated.sort(
            key=lambda t: (
                _PRIORITY_RANK.get(t[0].priority, 9),
                t[1] if t[1] is not None else 9_999,
                -t[0].created_at.timestamp(),
            )
        )

        total = len(annotated)
        start = (filters.page - 1) * filters.page_size
        page_items = annotated[start : start + filters.page_size]
        return page_items, total

    # --- Claim ---

    def claim(self, ngo: NGO, report_id: uuid.UUID, *, actor_id: uuid.UUID, ip: str | None) -> Report:
        # Row-level lock prevents two NGOs claiming concurrently.
        report = self.db.scalars(
            select(Report).where(Report.id == report_id).with_for_update()
        ).first()
        if not report:
            raise NotFoundError("Report not found")

        if report.claimed_by_ngo_id is not None:
            if report.claimed_by_ngo_id == ngo.id:
                raise ConflictError("You have already claimed this report", code="already_claimed")
            raise ConflictError("This report has already been claimed by another NGO", code="claimed_elsewhere")

        if report.status in (ReportStatus.REJECTED, ReportStatus.CLOSED):
            raise ValidationError("This report can no longer be claimed", code="not_claimable")

        report.claimed_by_ngo_id = ngo.id
        report.status = ReportStatus.CLAIMED
        report.claimed_at = datetime.now(timezone.utc)

        add_timeline_event(
            self.db,
            report_id=report.id,
            event_type="claimed",
            title="Claimed by NGO",
            description=f"{ngo.name} accepted the case.",
            actor_id=actor_id,
            is_public=True,
        )
        record_audit(
            self.db,
            action="report.claim",
            actor_id=actor_id,
            entity_type="report",
            entity_id=str(report.id),
            ip_address=ip,
            meta={"ngo_id": str(ngo.id), "tracking_id": report.tracking_id},
        )
        if report.reporter_id:
            notify(
                self.db,
                user_id=report.reporter_id,
                title=f"Your report {report.tracking_id} was claimed",
                body=f"{ngo.name} is now coordinating a response.",
                type_=NotificationType.INFO,
            )
        return report

    # --- Status transitions ---

    def update_status(
        self,
        ngo: NGO,
        report_id: uuid.UUID,
        new_status: ReportStatus,
        *,
        actor_id: uuid.UUID,
        ip: str | None,
        note: str | None = None,
    ) -> Report:
        report = self.db.scalars(
            select(Report).where(Report.id == report_id).with_for_update()
        ).first()
        if not report:
            raise NotFoundError("Report not found")
        if report.claimed_by_ngo_id != ngo.id:
            raise ForbiddenError("This case is not assigned to your organization", code="not_your_case")

        allowed = _TRANSITIONS.get(report.status, set())
        if new_status not in allowed:
            raise ValidationError(
                f"Cannot move a case from '{report.status.value}' to '{new_status.value}'",
                code="invalid_transition",
            )

        # Snapshot the pre-change state into version history.
        snapshot(
            self.db, entity_type="report", entity_id=report.id, change_kind="status_change",
            actor_id=actor_id,
            data={"status": report.status.value, "priority": report.priority.value,
                  "claimed_by_ngo_id": str(report.claimed_by_ngo_id) if report.claimed_by_ngo_id else None},
        )

        report.status = new_status
        if new_status == ReportStatus.CLOSED:
            report.closed_at = datetime.now(timezone.utc)

        label = _STATUS_LABELS.get(new_status, new_status.value.replace("_", " ").title())
        add_timeline_event(
            self.db,
            report_id=report.id,
            event_type=new_status.value,
            title=label,
            description=note,
            actor_id=actor_id,
            is_public=True,
        )
        record_audit(
            self.db,
            action="report.status_change",
            actor_id=actor_id,
            entity_type="report",
            entity_id=str(report.id),
            ip_address=ip,
            meta={"to": new_status.value, "ngo_id": str(ngo.id)},
        )
        if report.reporter_id:
            notify(
                self.db,
                user_id=report.reporter_id,
                title=f"Update on report {report.tracking_id}",
                body=label,
                type_=NotificationType.INFO,
            )
        return report

    @staticmethod
    def image_count(report: Report) -> int:
        return len(report.images)
