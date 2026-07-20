"""Automation engine: runs configurable rules on a periodic scheduler.

Each rule is an AutomationRule row. The scheduler wakes on an interval, finds
enabled rules whose threshold has elapsed, and executes the matching handler.
Handlers are deliberately conservative and idempotent.

Two invariants every handler must respect:

* Every write to ``Report.status`` goes through
  :func:`app.services.ngo_reports.apply_status_transition`, so automation can
  never produce a status edge a human operator would be refused.
* Each handler runs inside its own SAVEPOINT (see :func:`run_due_rules`), so a
  handler that raises half-way leaves no partially applied mutation behind.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.audit_log import AuditLog
from app.models.automation import AutomationRule
from app.models.case_timeline import CaseTimelineEvent
from app.models.enums import (
    AutomationTrigger,
    NotificationType,
    ReportPriority,
    ReportStatus,
)
from app.models.ngo import NGO
from app.models.report import Report
from app.models.volunteer_assignment import VolunteerAssignment
from app.services.audit import add_timeline_event, notify, record_audit
from app.services.geo_utils import bounding_box, haversine_km
from app.services.ngo_reports import apply_status_transition

logger = get_logger(__name__)

# Active (in-flight) rescue statuses, reused by a couple of rules.
_ACTIVE = {
    ReportStatus.CLAIMED, ReportStatus.VOLUNTEER_ASSIGNED, ReportStatus.VOLUNTEER_ACCEPTED,
    ReportStatus.ON_ROUTE, ReportStatus.REACHED_LOCATION,
}

# Statuses an inactivity rule is allowed to act on. Deliberately excludes every
# dispatched state (VOLUNTEER_ACCEPTED, ON_ROUTE, REACHED_LOCATION): a team that
# is on its way to, or standing at, the scene is not an abandoned case, and its
# `updated_at` legitimately stops moving while the work happens off-table.
_INACTIVITY_ELIGIBLE = {ReportStatus.CLAIMED, ReportStatus.VOLUNTEER_ASSIGNED}

# Marker event types written by this module. They are excluded from the
# "last activity" calculation (otherwise automation would keep resetting its own
# staleness clock) and are used instead as explicit already-handled flags.
_EVENT_ESCALATED = "escalated"
_EVENT_INACTIVITY_FLAGGED = "inactivity_flagged"
_MARKER_EVENTS = (_EVENT_ESCALATED, _EVENT_INACTIVITY_FLAGGED)

# Retention windows (days). Overridable per rule via AutomationRule.config.
_DEFAULT_MEDIA_RETENTION_DAYS = 90
_DEFAULT_PII_RETENTION_DAYS = 180
_DEFAULT_AUDIT_RETENTION_DAYS = 365 * 3


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    """Normalize a possibly naive DB timestamp to aware UTC.

    SQLite (and any column declared without a timezone) hands back naive
    datetimes; comparing those to `_now()` raises TypeError.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _rule_days(rule: AutomationRule, key: str, default: int) -> int:
    config = rule.config or {}
    try:
        value = int(config.get(key, default))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


# --- Activity tracking -------------------------------------------------------

def _latest_child_activity(
    db: Session, report_ids: list[uuid.UUID]
) -> dict[uuid.UUID, datetime]:
    """Latest child-table write per report.

    `reports.updated_at` only moves when the *report row itself* is written.
    Timeline events, notes, attachments and volunteer-assignment transitions all
    live in child tables, so a case can be under active work for hours while its
    `updated_at` sits frozen. Staleness must be measured against those too.
    """
    latest: dict[uuid.UUID, datetime] = {}
    if not report_ids:
        return latest

    def _merge(rows) -> None:
        for report_id, ts in rows:
            ts = _as_utc(ts)
            if ts is None:
                continue
            current = latest.get(report_id)
            if current is None or ts > current:
                latest[report_id] = ts

    _merge(
        db.execute(
            select(
                CaseTimelineEvent.report_id,
                func.max(CaseTimelineEvent.created_at),
            )
            .where(
                CaseTimelineEvent.report_id.in_(report_ids),
                CaseTimelineEvent.event_type.notin_(_MARKER_EVENTS),
            )
            .group_by(CaseTimelineEvent.report_id)
        ).all()
    )
    _merge(
        db.execute(
            select(
                VolunteerAssignment.report_id,
                func.max(VolunteerAssignment.updated_at),
            )
            .where(VolunteerAssignment.report_id.in_(report_ids))
            .group_by(VolunteerAssignment.report_id)
        ).all()
    )
    return latest


def _last_marker_at(db: Session, report_id: uuid.UUID, event_type: str) -> datetime | None:
    return _as_utc(
        db.scalar(
            select(func.max(CaseTimelineEvent.created_at)).where(
                CaseTimelineEvent.report_id == report_id,
                CaseTimelineEvent.event_type == event_type,
            )
        )
    )


def _ngos_covering(ngos: list[NGO], report: Report) -> list[NGO]:
    """NGOs whose service-area bounding box (then exact radius) covers a report."""
    if report.latitude is None or report.longitude is None:
        return []
    out: list[NGO] = []
    for ngo in ngos:
        if ngo.service_latitude is None or ngo.service_longitude is None:
            continue
        radius = ngo.service_radius_km or 0
        min_lat, max_lat, min_lon, max_lon = bounding_box(
            ngo.service_latitude, ngo.service_longitude, radius
        )
        if not (min_lat <= report.latitude <= max_lat and min_lon <= report.longitude <= max_lon):
            continue
        if haversine_km(
            ngo.service_latitude, ngo.service_longitude, report.latitude, report.longitude
        ) > radius:
            continue
        out.append(ngo)
    return out


def _notifiable_ngos(db: Session) -> list[NGO]:
    return list(
        db.scalars(
            select(NGO).where(NGO.owner_id.is_not(None), NGO.is_verified.is_(True))
        ).all()
    )


# --- Handlers ----------------------------------------------------------------

def _escalate_unclaimed(db: Session, rule: AutomationRule) -> int:
    """Flag reports unclaimed beyond the threshold: bump priority where there is
    headroom and notify the owners of every verified NGO covering the location.

    Escalation is tracked by an explicit `escalated` timeline marker, never
    inferred from `priority == CRITICAL` — a report *filed* as critical (child
    protection, medical) is exactly the case that most needs escalating, and the
    old priority check silently skipped every one of them.
    """
    cutoff = _now() - timedelta(minutes=rule.threshold_minutes)
    stmt = select(Report).where(
        Report.status == ReportStatus.PENDING,
        Report.claimed_by_ngo_id.is_(None),
        Report.created_at <= cutoff,
    )
    candidates = list(db.scalars(stmt).all())
    ngos = _notifiable_ngos(db) if candidates else []

    count = 0
    notified = 0
    for report in candidates:
        # Idempotency: one escalation per report, tracked explicitly.
        if _last_marker_at(db, report.id, _EVENT_ESCALATED) is not None:
            continue

        was = report.priority
        if report.priority != ReportPriority.CRITICAL:
            report.priority = ReportPriority.CRITICAL

        covering = _ngos_covering(ngos, report)
        for ngo in covering:
            notify(
                db, user_id=ngo.owner_id,
                title=f"Unclaimed report near you: {report.tracking_id}",
                body=(
                    f"Filed {int((_now() - _as_utc(report.created_at)).total_seconds() // 60)} "
                    f"minutes ago and still unclaimed. {report.address or 'Location on file'}."
                ),
                type_=NotificationType.WARNING,
            )
            notified += 1

        add_timeline_event(
            db, report_id=report.id, event_type=_EVENT_ESCALATED,
            title="Escalated",
            description=(
                f"Auto-escalated: unclaimed past threshold. "
                f"Priority {was.value} -> {report.priority.value}; "
                f"{len(covering)} nearby organization(s) notified."
            ),
            is_public=False,
        )
        record_audit(
            db, action="automation.escalate_unclaimed",
            entity_type="report", entity_id=str(report.id),
            meta={
                "tracking_id": report.tracking_id,
                "priority_from": was.value,
                "priority_to": report.priority.value,
                "ngos_notified": [str(n.id) for n in covering],
            },
        )
        count += 1

    if count:
        record_audit(
            db, action="automation.escalate_unclaimed.summary",
            meta={"count": count, "notifications": notified},
        )
    return count


def _close_inactive(db: Session, rule: AutomationRule) -> int:
    """Surface cases with no activity past the threshold to the owning NGO.

    This rule does NOT close anything on its own. Closing a live case out from
    under a responding team makes the citizen's Track page read "Case Closed"
    while a team is on scene; only a human with the case in front of them can
    make that call. Automation's job here is to raise a hand.
    """
    cutoff = _now() - timedelta(minutes=rule.threshold_minutes)
    # `last_activity >= updated_at` always, so filtering on updated_at in SQL is
    # a sound (never over-eager) pre-filter; the exact test happens below.
    candidates = list(
        db.scalars(
            select(Report).where(
                Report.status.in_(_INACTIVITY_ELIGIBLE),
                Report.updated_at <= cutoff,
            )
        ).all()
    )
    child_activity = _latest_child_activity(db, [r.id for r in candidates])

    count = 0
    for report in candidates:
        stamps = [_as_utc(report.updated_at)]
        child = child_activity.get(report.id)
        if child is not None:
            stamps.append(child)
        last_activity = max(s for s in stamps if s is not None)
        if last_activity > cutoff:
            continue

        # Idempotency: don't re-nag until there has been fresh real activity.
        flagged_at = _last_marker_at(db, report.id, _EVENT_INACTIVITY_FLAGGED)
        if flagged_at is not None and flagged_at >= last_activity:
            continue

        idle_minutes = int((_now() - last_activity).total_seconds() // 60)
        if report.claimed_by and report.claimed_by.owner_id:
            notify(
                db, user_id=report.claimed_by.owner_id,
                title=f"Case {report.tracking_id} has gone quiet",
                body=(
                    f"No activity for {idle_minutes} minutes while in "
                    f"'{report.status.value}'. Update or close it if it is resolved."
                ),
                type_=NotificationType.WARNING,
            )
        add_timeline_event(
            db, report_id=report.id, event_type=_EVENT_INACTIVITY_FLAGGED,
            title="Inactivity flagged",
            description=f"No activity for {idle_minutes} minutes; owning NGO notified.",
            is_public=False,
        )
        record_audit(
            db, action="automation.flag_inactive",
            entity_type="report", entity_id=str(report.id),
            meta={
                "tracking_id": report.tracking_id,
                "status": report.status.value,
                "idle_minutes": idle_minutes,
                "notified_ngo_id": str(report.claimed_by_ngo_id) if report.claimed_by_ngo_id else None,
            },
        )
        count += 1

    if count:
        record_audit(db, action="automation.close_inactive", meta={"flagged": count})
    return count


def _purge_expired(db: Session, rule: AutomationRule, storage=None) -> int:
    """Retention purge. Idempotent: re-running is a no-op once data is gone.

    * media + exact coordinates: purged N days after `closed_at` (default 90)
    * `reporter_name` / `reporter_phone`: nulled at N days (default 180)
    * audit logs: deleted at N days (default 3 years)
    """
    if storage is None:
        from app.services.storage import get_storage

        storage = get_storage()

    now = _now()
    media_cutoff = now - timedelta(days=_rule_days(rule, "media_retention_days", _DEFAULT_MEDIA_RETENTION_DAYS))
    pii_cutoff = now - timedelta(days=_rule_days(rule, "pii_retention_days", _DEFAULT_PII_RETENTION_DAYS))
    audit_cutoff = now - timedelta(days=_rule_days(rule, "audit_retention_days", _DEFAULT_AUDIT_RETENTION_DAYS))

    changed = 0

    # --- Stage 1: media + exact location ---
    for report in db.scalars(
        select(Report).where(Report.closed_at.is_not(None), Report.closed_at <= media_cutoff)
    ).all():
        images = list(report.images)
        had_coords = report.latitude is not None or report.longitude is not None
        if not images and not had_coords:
            continue  # already purged

        for image in images:
            try:
                storage.delete(image.storage_key)
            except Exception:  # noqa: BLE001 - a missing object must not block the row delete
                logger.warning("Retention purge: storage delete failed for %s", image.storage_key)
            db.delete(image)
        report.latitude = None
        report.longitude = None

        # A retained-but-open case is an accounting error; close it properly
        # rather than writing the terminal status directly.
        if report.status not in (ReportStatus.CLOSED, ReportStatus.REJECTED):
            try:
                apply_status_transition(report, ReportStatus.CLOSED)
            except Exception:  # noqa: BLE001
                logger.warning(
                    "Retention purge: cannot close report %s from '%s'",
                    report.id, report.status.value,
                )

        add_timeline_event(
            db, report_id=report.id, event_type="retention_purge",
            title="Media and precise location purged",
            description="Retention policy: photos and exact coordinates removed.",
            is_public=False,
        )
        record_audit(
            db, action="retention.purge_media",
            entity_type="report", entity_id=str(report.id),
            meta={"images_deleted": len(images), "coordinates_cleared": had_coords},
        )
        changed += 1

    # --- Stage 2: reporter PII ---
    for report in db.scalars(
        select(Report).where(
            Report.closed_at.is_not(None),
            Report.closed_at <= pii_cutoff,
            (Report.reporter_name.is_not(None)) | (Report.reporter_phone.is_not(None)),
        )
    ).all():
        report.reporter_name = None
        report.reporter_phone = None
        add_timeline_event(
            db, report_id=report.id, event_type="retention_purge",
            title="Reporter contact details purged",
            description="Retention policy: reporter name and phone removed.",
            is_public=False,
        )
        record_audit(
            db, action="retention.purge_pii",
            entity_type="report", entity_id=str(report.id),
        )
        changed += 1

    # --- Stage 3: audit logs ---
    stale_audits = db.scalar(
        select(func.count()).select_from(AuditLog).where(AuditLog.created_at <= audit_cutoff)
    ) or 0
    if stale_audits:
        db.execute(delete(AuditLog).where(AuditLog.created_at <= audit_cutoff))
        record_audit(db, action="retention.purge_audit", meta={"deleted": stale_audits})
        changed += stale_audits

    return changed


def _weekly_summary(db: Session, rule: AutomationRule) -> int:
    """Send each NGO owner a one-week activity summary notification."""
    since = _now() - timedelta(days=7)
    sent = 0
    for ngo in db.scalars(select(NGO).where(NGO.owner_id.is_not(None))).all():
        claimed = [
            r for r in ngo.claimed_reports
            if r.claimed_at and _as_utc(r.claimed_at) >= since
        ]
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


# Public alias: the retention purge is also callable directly (ops runbook).
purge_expired = _purge_expired


_HANDLERS = {
    AutomationTrigger.ESCALATE_UNCLAIMED: _escalate_unclaimed,
    AutomationTrigger.CLOSE_INACTIVE: _close_inactive,
    AutomationTrigger.WEEKLY_SUMMARY: _weekly_summary,
    # ARCHIVE_COMPLETED is the retention/aging trigger; there is no separate
    # PURGE_EXPIRED member on AutomationTrigger (that enum is shared with a
    # migrated DB enum type, so adding one is a migration, not a code change).
    AutomationTrigger.ARCHIVE_COMPLETED: _purge_expired,
    # EXPAND_RADIUS / VOLUNTEER_REMINDER are no-ops for now (handlers can be
    # added without touching the scheduler).
}


def run_due_rules(db: Session | None = None) -> dict:
    """Execute all enabled rules whose threshold interval has elapsed. Synchronous;
    invoked by the scheduler via the job runner / to_thread.

    Each handler runs inside its own SAVEPOINT. A handler that raises is rolled
    back to that savepoint, so the outer commit never persists a half-applied
    rule, and `last_run_at` stays unset so the rule is retried cleanly.
    """
    owns_session = db is None
    db = db or SessionLocal()
    results: dict[str, int] = {}
    try:
        rules = db.scalars(select(AutomationRule).where(AutomationRule.enabled.is_(True))).all()
        for rule in rules:
            handler = _HANDLERS.get(rule.trigger)
            if handler is None:
                continue
            # Respect a per-rule minimum interval between runs.
            if rule.last_run_at:
                elapsed = (_now() - _as_utc(rule.last_run_at)).total_seconds() / 60
                if elapsed < rule.threshold_minutes:
                    continue
            savepoint = db.begin_nested()
            try:
                n = handler(db, rule)
                rule.last_run_at = _now()
                rule.run_count += 1
                savepoint.commit()
                results[rule.trigger.value] = results.get(rule.trigger.value, 0) + n
            except Exception:  # noqa: BLE001
                if savepoint.is_active:
                    savepoint.rollback()
                logger.exception("Automation rule %s failed", rule.id)
        db.commit()
    finally:
        if owns_session:
            db.close()
    return results


async def scheduler_loop(interval_seconds: int = 300) -> None:
    """Periodically run due automation rules. Started in the app lifespan."""
    import asyncio

    from app.services.jobs import runner

    while True:
        try:
            await asyncio.sleep(interval_seconds)
            runner.enqueue("automation.run_due_rules", run_due_rules)
        except asyncio.CancelledError:
            return
        except Exception:  # noqa: BLE001
            logger.exception("Scheduler tick failed")
