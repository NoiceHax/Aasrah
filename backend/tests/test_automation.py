"""Automation engine + guarded status transition regression tests.

These cover three failure modes that were live in production behaviour:

1. A dispatched (ON_ROUTE) case being auto-closed under a responding team.
2. `threshold_minutes=0` being accepted, which makes an inactivity rule match
   the entire live caseload on its first tick.
3. `complete()` resurrecting a CLOSED case into RESCUE_COMPLETED.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.api.v1.admin_ops import AutomationRuleIn
from app.core.exceptions import ValidationError
from app.models.automation import AutomationRule
from app.models.enums import (
    AssignmentStatus,
    AutomationTrigger,
    ReportStatus,
    SituationType,
    UserRole,
)
from app.models.ngo import NGO
from app.models.report import Report
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.volunteer_assignment import VolunteerAssignment
from app.services.automation import _close_inactive
from app.services.vol_service import VolService


def _make_report(db, *, status: ReportStatus, age_minutes: int, ngo_id=None) -> Report:
    stale = datetime.now(timezone.utc) - timedelta(minutes=age_minutes)
    report = Report(
        tracking_id=f"AR-{uuid.uuid4().hex[:8]}",
        situation=SituationType.SHELTER,
        status=status,
        description="test case",
        claimed_by_ngo_id=ngo_id,
        created_at=stale,
        updated_at=stale,
    )
    db.add(report)
    db.flush()
    return report


def _make_rule(db, trigger: AutomationTrigger, threshold_minutes: int = 30) -> AutomationRule:
    rule = AutomationRule(name="t", trigger=trigger, threshold_minutes=threshold_minutes)
    db.add(rule)
    db.flush()
    return rule


def _make_ngo(db) -> NGO:
    owner = User(
        email=f"ngo-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="x",
        role=UserRole.NGO,
    )
    db.add(owner)
    db.flush()
    ngo = NGO(owner_id=owner.id, name="Test NGO", is_verified=True)
    db.add(ngo)
    db.flush()
    return ngo


# --- (a) a dispatched case is never auto-closed -------------------------------

def test_on_route_case_past_threshold_is_not_auto_closed(db):
    ngo = _make_ngo(db)
    report = _make_report(db, status=ReportStatus.ON_ROUTE, age_minutes=600, ngo_id=ngo.id)
    rule = _make_rule(db, AutomationTrigger.CLOSE_INACTIVE, threshold_minutes=30)

    _close_inactive(db, rule)
    db.flush()
    db.refresh(report)

    assert report.status is ReportStatus.ON_ROUTE, "a team on route must not be closed out"
    assert report.closed_at is None


def test_stale_claimed_case_is_flagged_not_closed(db):
    """The rule raises a hand to the owning NGO; it never closes the case."""
    ngo = _make_ngo(db)
    report = _make_report(db, status=ReportStatus.CLAIMED, age_minutes=600, ngo_id=ngo.id)
    rule = _make_rule(db, AutomationTrigger.CLOSE_INACTIVE, threshold_minutes=30)

    assert _close_inactive(db, rule) == 1
    db.flush()
    db.refresh(report)

    assert report.status is ReportStatus.CLAIMED
    assert report.closed_at is None
    types = [e.event_type for e in report.timeline_events]
    assert "inactivity_flagged" in types

    # Idempotent: a second tick with no fresh activity does not re-notify.
    assert _close_inactive(db, rule) == 0


def test_child_table_activity_keeps_a_case_fresh(db):
    """`reports.updated_at` is frozen, but a volunteer assignment moved 1 min ago."""
    ngo = _make_ngo(db)
    report = _make_report(db, status=ReportStatus.VOLUNTEER_ASSIGNED, age_minutes=600, ngo_id=ngo.id)
    user = User(email=f"v-{uuid.uuid4().hex[:8]}@example.com", hashed_password="x",
                role=UserRole.VOLUNTEER)
    db.add(user)
    db.flush()
    volunteer = Volunteer(user_id=user.id)
    db.add(volunteer)
    db.flush()
    now = datetime.now(timezone.utc)
    db.add(VolunteerAssignment(
        report_id=report.id, volunteer_id=volunteer.id,
        status=AssignmentStatus.ACCEPTED, created_at=now, updated_at=now,
    ))
    db.flush()

    rule = _make_rule(db, AutomationTrigger.CLOSE_INACTIVE, threshold_minutes=30)
    assert _close_inactive(db, rule) == 0


# --- (b) threshold_minutes bounds ---------------------------------------------

def test_threshold_minutes_zero_is_rejected():
    with pytest.raises(PydanticValidationError):
        AutomationRuleIn(name="r", trigger=AutomationTrigger.CLOSE_INACTIVE, threshold_minutes=0)


def test_threshold_minutes_bounds():
    with pytest.raises(PydanticValidationError):
        AutomationRuleIn(name="r", trigger=AutomationTrigger.CLOSE_INACTIVE, threshold_minutes=-1)
    with pytest.raises(PydanticValidationError):
        AutomationRuleIn(name="r", trigger=AutomationTrigger.CLOSE_INACTIVE, threshold_minutes=10081)
    assert AutomationRuleIn(
        name="r", trigger=AutomationTrigger.CLOSE_INACTIVE, threshold_minutes=5
    ).threshold_minutes == 5
    # Default stays 30.
    assert AutomationRuleIn(
        name="r", trigger=AutomationTrigger.CLOSE_INACTIVE
    ).threshold_minutes == 30


# --- retention purge ----------------------------------------------------------

class _FakeStorage:
    def __init__(self):
        self.deleted: list[str] = []

    def delete(self, key: str) -> None:
        self.deleted.append(key)


def test_purge_expired_is_idempotent(db):
    from app.models.report_image import ReportImage
    from app.services.automation import purge_expired

    ngo = _make_ngo(db)
    report = _make_report(db, status=ReportStatus.CLOSED, age_minutes=10, ngo_id=ngo.id)
    report.latitude, report.longitude = 12.9, 77.6
    report.reporter_name, report.reporter_phone = "Asha", "+911234567890"
    report.closed_at = datetime.now(timezone.utc) - timedelta(days=400)
    db.add(ReportImage(report_id=report.id, storage_key="AR-x/a.webp"))
    db.flush()

    rule = _make_rule(db, AutomationTrigger.ARCHIVE_COMPLETED, threshold_minutes=1440)
    storage = _FakeStorage()

    assert purge_expired(db, rule, storage=storage) >= 1
    db.flush()
    db.refresh(report)
    assert storage.deleted == ["AR-x/a.webp"]
    assert report.images == []
    assert report.latitude is None and report.longitude is None
    assert report.reporter_name is None and report.reporter_phone is None

    # Second run finds nothing left to purge (audit rows are younger than 3y).
    assert purge_expired(db, rule, storage=_FakeStorage()) == 0


# --- (c) complete() must not resurrect a terminal case ------------------------

def test_complete_on_closed_report_raises(db):
    ngo = _make_ngo(db)
    report = _make_report(db, status=ReportStatus.CLOSED, age_minutes=10, ngo_id=ngo.id)
    closed_at = datetime.now(timezone.utc) - timedelta(days=1)
    report.closed_at = closed_at

    user = User(email=f"v-{uuid.uuid4().hex[:8]}@example.com", hashed_password="x",
                role=UserRole.VOLUNTEER)
    db.add(user)
    db.flush()
    volunteer = Volunteer(user_id=user.id)
    db.add(volunteer)
    db.flush()
    assignment = VolunteerAssignment(
        report_id=report.id, volunteer_id=volunteer.id, status=AssignmentStatus.IN_PROGRESS,
    )
    db.add(assignment)
    db.flush()

    with pytest.raises(ValidationError) as exc:
        VolService(db).complete(
            volunteer, assignment.id, actor_id=user.id,
            notes=None, checklist=None, hours=2.0,
        )
    assert exc.value.code == "invalid_transition"

    # Nothing was mutated: status, closed_at, and volunteer metrics are intact.
    assert report.status is ReportStatus.CLOSED
    assert report.closed_at == closed_at
    assert assignment.status is AssignmentStatus.IN_PROGRESS
    assert volunteer.completed_rescues == 0
    assert volunteer.total_hours == 0.0
