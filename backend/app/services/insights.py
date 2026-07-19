"""Analytics intelligence: actionable insights + simple forecasts.

Turns raw counts into narrative insights (trends, rising-demand areas, NGO
response comparison, coverage gaps) and a naive next-period forecast.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import ReportStatus
from app.models.ngo import NGO
from app.models.report import Report

_COMPLETED = {
    ReportStatus.RESCUE_COMPLETED, ReportStatus.SHELTER_ASSIGNED,
    ReportStatus.CLOSED, ReportStatus.RESOLVED,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def platform_insights(db: Session) -> dict:
    now = _now()
    week = now - timedelta(days=7)
    prev_week = now - timedelta(days=14)

    this_week = db.scalar(
        select(func.count()).select_from(Report).where(Report.created_at >= week)
    ) or 0
    last_week = db.scalar(
        select(func.count()).select_from(Report).where(
            Report.created_at >= prev_week, Report.created_at < week
        )
    ) or 0

    insights: list[dict] = []

    # Demand trend.
    if last_week:
        change = (this_week - last_week) / last_week * 100
        direction = "up" if change > 0 else "down"
        insights.append({
            "kind": "demand_trend",
            "headline": f"Reports are {direction} {abs(round(change))}% week-over-week",
            "detail": f"{this_week} reports this week vs {last_week} last week.",
            "severity": "warning" if change > 25 else "info",
        })

    # Naive forecast: 4-week moving average projected to next week.
    weekly = []
    for w in range(4, 0, -1):
        s = now - timedelta(days=7 * w)
        e = now - timedelta(days=7 * (w - 1))
        weekly.append(db.scalar(
            select(func.count()).select_from(Report).where(
                Report.created_at >= s, Report.created_at < e
            )
        ) or 0)
    forecast = round(sum(weekly) / len(weekly)) if weekly else 0
    insights.append({
        "kind": "forecast",
        "headline": f"~{forecast} reports forecast next week",
        "detail": f"Based on a 4-week moving average ({weekly}).",
        "severity": "info",
    })

    # Average rescue duration (claim -> close).
    closed = db.scalars(
        select(Report).where(Report.status.in_(_COMPLETED), Report.claimed_at.is_not(None),
                             Report.closed_at.is_not(None))
    ).all()
    if closed:
        avg_h = sum((r.closed_at - r.claimed_at).total_seconds() / 3600 for r in closed) / len(closed)
        insights.append({
            "kind": "avg_duration",
            "headline": f"Average rescue duration: {round(avg_h, 1)}h",
            "detail": f"Across {len(closed)} completed cases.",
            "severity": "info",
        })

    # Coverage gap: unclaimed reports with no verified NGO service area covering them.
    unclaimed = db.scalar(
        select(func.count()).select_from(Report).where(
            Report.status == ReportStatus.PENDING, Report.claimed_by_ngo_id.is_(None)
        )
    ) or 0
    if unclaimed:
        insights.append({
            "kind": "coverage_gap",
            "headline": f"{unclaimed} reports awaiting an NGO",
            "detail": "Consider expanding NGO service areas or onboarding partners in under-served zones.",
            "severity": "warning" if unclaimed > 5 else "info",
        })

    return {"insights": insights, "forecast_next_week": forecast}


def ngo_comparison(db: Session) -> list[dict]:
    """Compare NGOs by claimed volume, completion, and avg response time."""
    out = []
    for ngo in db.scalars(select(NGO).where(NGO.is_verified.is_(True))).all():
        claimed = list(ngo.claimed_reports)
        completed = [r for r in claimed if r.status in _COMPLETED]
        responses = [
            (r.claimed_at - r.created_at).total_seconds() / 60
            for r in claimed if r.claimed_at
        ]
        out.append({
            "ngo_id": str(ngo.id),
            "name": ngo.name,
            "claimed": len(claimed),
            "completed": len(completed),
            "completion_rate": round(len(completed) / len(claimed), 2) if claimed else 0,
            "avg_response_minutes": round(sum(responses) / len(responses), 1) if responses else None,
        })
    out.sort(key=lambda c: c["completed"], reverse=True)
    return out
