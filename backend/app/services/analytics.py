"""Analytics aggregations scoped to a single NGO's cases."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import AssignmentStatus, ReportStatus, VolunteerStatus
from app.models.ngo import NGO
from app.models.report import Report
from app.models.volunteer import Volunteer
from app.models.volunteer_assignment import VolunteerAssignment
from app.schemas.analytics import (
    AnalyticsOut,
    DashboardOut,
    HeatmapPoint,
    KpiCards,
    TimeSeriesPoint,
)
from app.services.geo_utils import bounding_box

# Statuses that represent an in-flight rescue vs. a finished one.
_ACTIVE_STATUSES = {
    ReportStatus.CLAIMED, ReportStatus.VOLUNTEER_ASSIGNED, ReportStatus.VOLUNTEER_ACCEPTED,
    ReportStatus.ON_ROUTE, ReportStatus.REACHED_LOCATION,
}
_COMPLETED_STATUSES = {
    ReportStatus.RESCUE_COMPLETED, ReportStatus.SHELTER_ASSIGNED, ReportStatus.CLOSED,
    ReportStatus.RESOLVED,
}


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def _claimed(self, ngo: NGO) -> list[Report]:
        return list(
            self.db.scalars(select(Report).where(Report.claimed_by_ngo_id == ngo.id)).all()
        )

    def _avg_response_minutes(self, reports: list[Report]) -> float | None:
        # Time from creation to claim, averaged.
        deltas = [
            (r.claimed_at - r.created_at).total_seconds() / 60
            for r in reports
            if r.claimed_at is not None
        ]
        return round(sum(deltas) / len(deltas), 1) if deltas else None

    def _success_rate(self, reports: list[Report]) -> float:
        finished = [r for r in reports if r.status in _COMPLETED_STATUSES or r.status == ReportStatus.REJECTED]
        if not finished:
            return 0.0
        succeeded = [r for r in finished if r.status in _COMPLETED_STATUSES]
        return round(len(succeeded) / len(finished), 3)

    def dashboard(self, ngo: NGO) -> DashboardOut:
        claimed = self._claimed(ngo)
        active = [r for r in claimed if r.status in _ACTIVE_STATUSES]
        completed = [r for r in claimed if r.status in _COMPLETED_STATUSES]

        # Pending nearby (unclaimed reports inside service area).
        pending_nearby = 0
        if ngo.service_latitude is not None and ngo.service_longitude is not None:
            min_lat, max_lat, min_lon, max_lon = bounding_box(
                ngo.service_latitude, ngo.service_longitude, ngo.service_radius_km
            )
            pending_nearby = self.db.scalar(
                select(func.count()).select_from(Report).where(
                    Report.status == ReportStatus.PENDING,
                    Report.claimed_by_ngo_id.is_(None),
                    Report.latitude.between(min_lat, max_lat),
                    Report.longitude.between(min_lon, max_lon),
                )
            ) or 0

        available_volunteers = self.db.scalar(
            select(func.count()).select_from(Volunteer).where(
                Volunteer.ngo_id == ngo.id,
                Volunteer.is_available.is_(True),
                Volunteer.status == VolunteerStatus.ACTIVE,
            )
        ) or 0

        return DashboardOut(
            pending_nearby=pending_nearby,
            claimed_cases=len(claimed),
            active_rescues=len(active),
            completed_rescues=len(completed),
            available_volunteers=available_volunteers,
            avg_response_minutes=self._avg_response_minutes(claimed),
            success_rate=self._success_rate(claimed),
            weekly_rescues=self._weekly_rescues(completed),
        )

    def _weekly_rescues(self, completed: list[Report]) -> list[TimeSeriesPoint]:
        now = datetime.now(timezone.utc)
        buckets: list[TimeSeriesPoint] = []
        for w in range(7, 0, -1):
            start = now - timedelta(weeks=w)
            end = now - timedelta(weeks=w - 1)
            # Bucket each completed report exactly once by its effective
            # completion time (closed_at, falling back to last-modified for any
            # legacy row that never got a closed_at). Additive; no per-bucket
            # short-circuit that would drop or fabricate counts.
            count = sum(
                1
                for r in completed
                if (ts := (r.closed_at or r.updated_at)) and start <= ts < end
            )
            buckets.append(TimeSeriesPoint(label=f"W-{w}", value=count))
        return buckets

    def analytics(self, ngo: NGO) -> AnalyticsOut:
        claimed = self._claimed(ngo)
        completed = [r for r in claimed if r.status in _COMPLETED_STATUSES]
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        active_volunteers = self.db.scalar(
            select(func.count()).select_from(Volunteer).where(
                Volunteer.ngo_id == ngo.id, Volunteer.status == VolunteerStatus.ACTIVE
            )
        ) or 0

        kpis = KpiCards(
            total_rescues=len(completed),
            avg_response_minutes=self._avg_response_minutes(claimed),
            active_volunteers=active_volunteers,
            success_rate=self._success_rate(claimed),
            cases_this_month=sum(1 for r in claimed if r.claimed_at and r.claimed_at >= month_start),
        )

        # Daily reports over the last 14 days (by creation).
        daily: list[TimeSeriesPoint] = []
        for d in range(13, -1, -1):
            day = (now - timedelta(days=d)).date()
            count = sum(1 for r in claimed if r.created_at.date() == day)
            daily.append(TimeSeriesPoint(label=day.isoformat()[5:], value=count))

        # Volunteer workload: completed assignments per volunteer.
        workload_rows = self.db.execute(
            select(Volunteer.id, func.count(VolunteerAssignment.id))
            .join(VolunteerAssignment, VolunteerAssignment.volunteer_id == Volunteer.id)
            .where(
                Volunteer.ngo_id == ngo.id,
                VolunteerAssignment.status == AssignmentStatus.COMPLETED,
            )
            .group_by(Volunteer.id)
        ).all()
        workload = [
            TimeSeriesPoint(label=str(vid)[:8], value=cnt) for vid, cnt in workload_rows
        ]

        heatmap = [
            HeatmapPoint(latitude=r.latitude, longitude=r.longitude, weight=1)
            for r in claimed
            if r.latitude is not None and r.longitude is not None
        ]

        return AnalyticsOut(
            kpis=kpis,
            daily_reports=daily,
            weekly_rescues=self._weekly_rescues(completed),
            volunteer_workload=workload,
            heatmap=heatmap,
        )
