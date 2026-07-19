"""Decision-support intelligence: priority scoring, NGO matching, volunteer
recommendation. All outputs are advisory; staff can override.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import (
    AssignmentStatus,
    ReportPriority,
    ReportStatus,
    SituationType,
    VolunteerStatus,
)
from app.models.ngo import NGO
from app.models.report import Report
from app.models.volunteer import Volunteer
from app.models.volunteer_assignment import VolunteerAssignment
from app.services.geo_utils import bounding_box, haversine_km


# --- Priority scoring ---------------------------------------------------------

def compute_priority(report: Report, *, nearby_recent: int = 0) -> tuple[float, ReportPriority]:
    """Dynamic 0..100 priority score + derived band.

    Signals: medical need, children present, situation type, hours waiting,
    time-of-day (night raises risk), and density of recent nearby reports.
    """
    score = 0.0
    analysis = report.ai_analysis or {}

    # Situation / medical.
    if report.situation == SituationType.MEDICAL or analysis.get("needs_medical"):
        score += 35
    if analysis.get("visible_injuries"):
        score += 15
    if report.situation == SituationType.SAFETY:
        score += 20
    if report.situation in (SituationType.SHELTER, SituationType.FOOD):
        score += 10

    # Vulnerable groups.
    if report.children_present or analysis.get("children_present"):
        score += 20
    if (analysis.get("age_range") or "") in ("elderly", "infant"):
        score += 10

    # Time waiting since submission.
    waiting_h = (datetime.now(timezone.utc) - report.created_at).total_seconds() / 3600
    score += min(waiting_h * 2, 20)  # up to +20 as it ages

    # Night-time (higher exposure risk): uses submission hour UTC as a proxy.
    hour = report.created_at.hour
    if hour >= 22 or hour <= 5:
        score += 8

    # Clustering: many recent nearby reports suggests a developing situation.
    score += min(nearby_recent * 3, 12)

    score = max(0.0, min(100.0, score))
    if score >= 70:
        band = ReportPriority.CRITICAL
    elif score >= 45:
        band = ReportPriority.HIGH
    elif score >= 20:
        band = ReportPriority.MEDIUM
    else:
        band = ReportPriority.STABLE
    return round(score, 1), band


def count_recent_nearby(db: Session, report: Report, *, radius_km: float = 2.0, hours: int = 24) -> int:
    """Count other recent reports within a small radius of this one."""
    if report.latitude is None or report.longitude is None:
        return 0
    from datetime import timedelta

    min_lat, max_lat, min_lon, max_lon = bounding_box(report.latitude, report.longitude, radius_km)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = db.scalars(
        select(Report).where(
            Report.id != report.id,
            Report.created_at >= cutoff,
            Report.latitude.between(min_lat, max_lat),
            Report.longitude.between(min_lon, max_lon),
        )
    ).all()
    return sum(
        1 for r in rows
        if haversine_km(report.latitude, report.longitude, r.latitude, r.longitude) <= radius_km
    )


# --- NGO matching -------------------------------------------------------------

def rank_ngos_for_report(db: Session, report: Report, *, radius_multiplier: float = 1.0) -> list[dict]:
    """Rank verified NGOs as candidates to handle a report.

    Score blends proximity, current workload (lighter is better), and capacity
    (more available volunteers is better). `radius_multiplier` widens the search
    for progressive escalation when a report stays unclaimed.
    """
    if report.latitude is None or report.longitude is None:
        return []

    candidates: list[dict] = []
    for ngo in db.scalars(select(NGO).where(NGO.is_verified.is_(True))).all():
        if ngo.service_latitude is None or ngo.service_longitude is None:
            continue
        dist = haversine_km(ngo.service_latitude, ngo.service_longitude, report.latitude, report.longitude)
        reach = ngo.service_radius_km * radius_multiplier
        if dist > reach:
            continue

        active = db.scalar(
            select(func.count()).select_from(Report).where(
                Report.claimed_by_ngo_id == ngo.id,
                Report.status.in_([
                    ReportStatus.CLAIMED, ReportStatus.VOLUNTEER_ASSIGNED,
                    ReportStatus.VOLUNTEER_ACCEPTED, ReportStatus.ON_ROUTE,
                    ReportStatus.REACHED_LOCATION,
                ]),
            )
        ) or 0
        available_vols = db.scalar(
            select(func.count()).select_from(Volunteer).where(
                Volunteer.ngo_id == ngo.id,
                Volunteer.is_available.is_(True),
                Volunteer.status == VolunteerStatus.ACTIVE,
            )
        ) or 0

        # Higher score = better candidate.
        proximity = max(0.0, 1 - dist / max(reach, 1)) * 50      # 0..50
        workload = max(0.0, 1 - active / 10) * 30                # 0..30, lighter load better
        capacity = min(available_vols, 5) / 5 * 20               # 0..20
        score = round(proximity + workload + capacity, 1)

        candidates.append({
            "ngo_id": str(ngo.id),
            "name": ngo.name,
            "distance_km": round(dist, 2),
            "active_cases": active,
            "available_volunteers": available_vols,
            "score": score,
        })

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates


# --- Volunteer recommendation -------------------------------------------------

def recommend_volunteers(db: Session, report: Report, ngo: NGO, *, limit: int = 5) -> list[dict]:
    """Recommend the NGO's volunteers best suited to a report.

    Score blends availability, proximity (if the volunteer has a location),
    light current workload, and experience (completed rescues).
    """
    volunteers = db.scalars(
        select(Volunteer).where(Volunteer.ngo_id == ngo.id, Volunteer.status == VolunteerStatus.ACTIVE)
    ).all()

    out: list[dict] = []
    for v in volunteers:
        active = db.scalar(
            select(func.count()).select_from(VolunteerAssignment).where(
                VolunteerAssignment.volunteer_id == v.id,
                VolunteerAssignment.status.in_([AssignmentStatus.ASSIGNED, AssignmentStatus.ACCEPTED,
                                                AssignmentStatus.ON_ROUTE, AssignmentStatus.ARRIVED,
                                                AssignmentStatus.IN_PROGRESS]),
            )
        ) or 0

        score = 0.0
        score += 40 if v.is_available else 0
        score += max(0.0, 1 - active / 3) * 25            # lighter load better
        score += min(v.completed_rescues, 20) / 20 * 20    # experience
        dist = None
        if v.latitude is not None and report.latitude is not None:
            dist = haversine_km(v.latitude, v.longitude, report.latitude, report.longitude)
            score += max(0.0, 1 - dist / 50) * 15          # proximity (within ~50km)

        out.append({
            "volunteer_id": str(v.id),
            "name": (v.user.full_name or v.user.email) if v.user else None,
            "is_available": v.is_available,
            "active_assignments": active,
            "completed_rescues": v.completed_rescues,
            "distance_km": round(dist, 2) if dist is not None else None,
            "skills": [s.strip() for s in (v.skills or "").split(",") if s.strip()],
            "score": round(score, 1),
        })

    out.sort(key=lambda c: c["score"], reverse=True)
    return out[:limit]
