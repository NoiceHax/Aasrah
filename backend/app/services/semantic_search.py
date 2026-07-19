"""Semantic (natural-language) report search.

A query like "children needing shelter waiting more than 3 hours" is parsed by
the AI provider (or heuristic fallback) into structured filters, then applied
to the reports table. Scoped to the requesting NGO's service area.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import ReportStatus, SituationType
from app.models.ngo import NGO
from app.models.report import Report
from app.services.ai import provider
from app.services.geo_utils import bounding_box, haversine_km


def search(db: Session, ngo: NGO, query: str, *, limit: int = 30) -> dict:
    filters = provider.parse_search_query(query)
    stmt = select(Report).options(selectinload(Report.images))

    # Restrict to the NGO's service area when it has one.
    has_area = ngo.service_latitude is not None and ngo.service_longitude is not None
    if has_area:
        min_lat, max_lat, min_lon, max_lon = bounding_box(
            ngo.service_latitude, ngo.service_longitude, ngo.service_radius_km
        )
        stmt = stmt.where(
            Report.latitude.between(min_lat, max_lat),
            Report.longitude.between(min_lon, max_lon),
        )

    if filters.children_only:
        stmt = stmt.where(Report.children_present.is_(True))
    if filters.medical_only:
        stmt = stmt.where(Report.situation == SituationType.MEDICAL)
    if filters.unclaimed_only:
        stmt = stmt.where(Report.claimed_by_ngo_id.is_(None), Report.status == ReportStatus.PENDING)
    if filters.status:
        try:
            stmt = stmt.where(Report.status == ReportStatus(filters.status))
        except ValueError:
            pass
    if filters.since_hours:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=filters.since_hours)
        stmt = stmt.where(Report.created_at >= cutoff)
    if filters.keywords:
        term = f"%{filters.keywords.strip()}%"
        stmt = stmt.where(or_(
            Report.description.ilike(term),
            Report.address.ilike(term),
            Report.ai_summary.ilike(term),
        ))

    reports = list(db.scalars(stmt.order_by(Report.created_at.desc())).all())

    # Post-filters that can't be expressed cleanly in SQL.
    now = datetime.now(timezone.utc)
    if filters.waiting_over_hours:
        threshold = filters.waiting_over_hours
        reports = [
            r for r in reports
            if r.claimed_by_ngo_id is None
            and (now - r.created_at).total_seconds() / 3600 >= threshold
        ]
    if filters.near_keyword:
        kw = filters.near_keyword.lower()
        reports = [r for r in reports if r.address and kw in r.address.lower()]

    return {
        "query": query,
        "parsed": filters.model_dump(),
        "count": len(reports[:limit]),
        "results": [
            {
                "id": str(r.id),
                "tracking_id": r.tracking_id,
                "situation": r.situation.value,
                "priority": r.priority.value,
                "status": r.status.value,
                "address": r.address,
                "summary": r.ai_summary,
                "children_present": r.children_present,
                "created_at": r.created_at.isoformat(),
            }
            for r in reports[:limit]
        ],
    }
