"""Automation engine: runs configurable rules on a periodic scheduler.

Each rule is an AutomationRule row. The scheduler wakes on an interval, finds
enabled rules whose threshold has elapsed, and executes the matching handler.
Handlers are deliberately conservative and idempotent.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.automation import AutomationRule
from app.models.enums import (
    AutomationTrigger,
    NotificationType,
    ReportStatus,
)
from app.models.ngo import NGO
from app.models.report import Report
from app.services.audit import add_timeline_event, notify, record_audit

logger = get_logger(__name__)

# Active (in-flight) rescue statuses, reused by a couple of rules.
_ACTIVE = {
    ReportStatus.CLAIMED, ReportStatus.VOLUNTEER_ASSIGNED, ReportStatus.VOLUNTEER_ACCEPTED,
    ReportStatus.ON_ROUTE, ReportStatus.REACHED_LOCATION,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _escalate_unclaimed(db: Session, rule: AutomationRule) -> int:
    """Flag reports unclaimed beyond the threshold by bumping them to CRITICAL
    priority and notifying nearby verified NGO owners."""
    cutoff = _now() - timedelta(minutes=rule.threshold_minutes)
    stmt = select(Report).where(
        Report.status == ReportStatus.PENDING,
        Report.claimed_by_ngo_id.is_(None),
        Report.created_at <= cutoff,
    )
    count = 0
    for report in db.scalars(stmt).all():
        from app.models.enums import ReportPriority
        if report.priority == ReportPriority.CRITICAL:
            continue
        report.priority = ReportPriority.CRITICAL
        add_timeline_event(
            db, report_id=report.id, event_type="escalated",
            title="Escalated", description="Auto-escalated: unclaimed past threshold.",
            is_public=False,
        )
        count += 1
    if count:
        record_audit(db, action="automation.escalate_unclaimed", meta={"count": count})
    return count


def _close_inactive(db: Session, rule: AutomationRule) -> int:
    """Close cases stuck in an active state with no update past the threshold."""
    cutoff = _now() - timedelta(minutes=rule.threshold_minutes)
    stmt = select(Report).where(Report.status.in_(_ACTIVE), Report.updated_at <= cutoff)
    count = 0
    for report in db.scalars(stmt).all():
        report.status = ReportStatus.CLOSED
        report.closed_at = _now()
        add_timeline_event(
            db, report_id=report.id, event_type="closed",
            title="Case Closed", description="Auto-closed due to inactivity.", is_public=True,
        )
        count += 1
    if count:
        record_audit(db, action="automation.close_inactive", meta={"count": count})
    return count


def _weekly_summary(db: Session, rule: AutomationRule) -> int:
    """Send each NGO owner a one-week activity summary notification."""
    since = _now() - timedelta(days=7)
    sent = 0
    for ngo in db.scalars(select(NGO).where(NGO.owner_id.is_not(None))).all():
        claimed = [r for r in ngo.claimed_reports if r.claimed_at and r.claimed_at >= since]
        completed = [r for r in claimed if r.status in (
            ReportStatus.RESCUE_COMPLETED, ReportStatus.SHELTER_ASSIGNED, ReportStatus.CLOSED,
        )]
        notify(
            db, user_id=ngo.owner_id,
            title="Your weekly summary",
            body=f"This week: {len(claimed)} cases claimed, {len(completed)} completed.",
            type_=NotificationType.INFO,
        )
        sent += 1
    if sent:
        record_audit(db, action="automation.weekly_summary", meta={"sent": sent})
    return sent


_HANDLERS = {
    AutomationTrigger.ESCALATE_UNCLAIMED: _escalate_unclaimed,
    AutomationTrigger.CLOSE_INACTIVE: _close_inactive,
    AutomationTrigger.WEEKLY_SUMMARY: _weekly_summary,
    # EXPAND_RADIUS / VOLUNTEER_REMINDER / ARCHIVE_COMPLETED are no-ops for now
    # (handlers can be added without touching the scheduler).
}


def run_due_rules() -> dict:
    """Execute all enabled rules whose threshold interval has elapsed. Synchronous;
    invoked by the scheduler via the job runner / to_thread."""
    db = SessionLocal()
    results: dict[str, int] = {}
    try:
        rules = db.scalars(select(AutomationRule).where(AutomationRule.enabled.is_(True))).all()
        for rule in rules:
            handler = _HANDLERS.get(rule.trigger)
            if handler is None:
                continue
            # Respect a per-rule minimum interval between runs.
            if rule.last_run_at:
                elapsed = (_now() - rule.last_run_at).total_seconds() / 60
                if elapsed < rule.threshold_minutes:
                    continue
            try:
                n = handler(db, rule)
                rule.last_run_at = _now()
                rule.run_count += 1
                results[rule.trigger.value] = results.get(rule.trigger.value, 0) + n
            except Exception:  # noqa: BLE001
                logger.exception("Automation rule %s failed", rule.id)
        db.commit()
    finally:
        db.close()
    return results


async def scheduler_loop(interval_seconds: int = 300) -> None:
    """Periodically run due automation rules. Started in the app lifespan."""
    from app.services.jobs import runner

    while True:
        try:
            await asyncio.sleep(interval_seconds)
            runner.enqueue("automation.run_due_rules", run_due_rules)
        except asyncio.CancelledError:
            return
        except Exception:  # noqa: BLE001
            logger.exception("Scheduler tick failed")
