"""Duplicate report detection.

Two reports likely describe the same person/situation when they are close in
space, close in time, and textually similar. We surface candidates as
suggestions; an NGO confirms a merge; we never auto-discard a report.
"""

from __future__ import annotations

import difflib
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.report import Report
from app.services.geo_utils import bounding_box, haversine_km

_PROXIMITY_KM = 0.3        # within ~300m
_TIME_WINDOW_HOURS = 12    # submitted within 12h of each other
_TEXT_SIMILARITY = 0.6     # summary/description overlap threshold


def _text(r: Report) -> str:
    return (r.ai_summary or r.description or "").lower()


def find_duplicates(db: Session, report: Report) -> list[dict]:
    """Return likely-duplicate reports of `report`, scored by combined signals."""
    if report.latitude is None or report.longitude is None:
        return []

    min_lat, max_lat, min_lon, max_lon = bounding_box(report.latitude, report.longitude, _PROXIMITY_KM * 2)
    window_start = report.created_at - timedelta(hours=_TIME_WINDOW_HOURS)
    window_end = report.created_at + timedelta(hours=_TIME_WINDOW_HOURS)

    candidates = db.scalars(
        select(Report).where(
            Report.id != report.id,
            Report.latitude.between(min_lat, max_lat),
            Report.longitude.between(min_lon, max_lon),
            Report.created_at.between(window_start, window_end),
        )
    ).all()

    base_text = _text(report)
    out: list[dict] = []
    for c in candidates:
        if c.latitude is None or c.longitude is None:
            continue
        dist = haversine_km(report.latitude, report.longitude, c.latitude, c.longitude)
        if dist > _PROXIMITY_KM:
            continue
        similarity = difflib.SequenceMatcher(None, base_text, _text(c)).ratio()
        if similarity < _TEXT_SIMILARITY and c.situation != report.situation:
            continue
        # Combined confidence: proximity + recency + text similarity.
        time_gap_h = abs((report.created_at - c.created_at).total_seconds()) / 3600
        proximity_score = max(0.0, 1 - dist / _PROXIMITY_KM)
        recency_score = max(0.0, 1 - time_gap_h / _TIME_WINDOW_HOURS)
        confidence = round((proximity_score * 0.4 + recency_score * 0.2 + similarity * 0.4), 2)
        out.append({
            "report_id": str(c.id),
            "tracking_id": c.tracking_id,
            "distance_km": round(dist, 3),
            "time_gap_hours": round(time_gap_h, 1),
            "text_similarity": round(similarity, 2),
            "confidence": confidence,
            "summary": c.ai_summary or c.description[:120],
            "status": c.status.value,
        })

    out.sort(key=lambda c: c["confidence"], reverse=True)
    return out


def merge_reports(db: Session, primary: Report, duplicate: Report) -> None:
    """Mark `duplicate` as a duplicate of `primary` (non-destructive)."""
    duplicate.duplicate_of_id = primary.id
