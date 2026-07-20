"""Volunteer assignment workflow + dashboard/performance aggregation."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models.enums import AssignmentStatus, NotificationType, ReportStatus
from app.models.report import Report
from app.models.volunteer import Volunteer
from app.models.volunteer_assignment import VolunteerAssignment
from app.services.audit import add_timeline_event, notify, record_audit
from app.services.ngo_reports import apply_status_transition
from app.services.security_sanitize import sanitize_text

# Volunteer-driven assignment transitions and the report status they imply.
# Volunteer-driven assignment transitions via advance(). COMPLETED is
# deliberately NOT reachable here; completion goes through complete() so
# metrics, completed_at, notes/checklist, and closed_at are all recorded.
_ASSIGNMENT_FLOW: dict[AssignmentStatus, AssignmentStatus] = {
    AssignmentStatus.ACCEPTED: AssignmentStatus.ON_ROUTE,
    AssignmentStatus.ON_ROUTE: AssignmentStatus.ARRIVED,
    AssignmentStatus.ARRIVED: AssignmentStatus.IN_PROGRESS,
}

# Map an assignment status onto the report status it should drive.
_REPORT_STATUS_FOR: dict[AssignmentStatus, ReportStatus] = {
    AssignmentStatus.ON_ROUTE: ReportStatus.ON_ROUTE,
    AssignmentStatus.ARRIVED: ReportStatus.REACHED_LOCATION,
    AssignmentStatus.IN_PROGRESS: ReportStatus.REACHED_LOCATION,
}

_TIMELINE_TITLES: dict[AssignmentStatus, str] = {
    AssignmentStatus.ON_ROUTE: "Responder On Route",
    AssignmentStatus.ARRIVED: "Reached Location",
    AssignmentStatus.IN_PROGRESS: "Rescue In Progress",
    AssignmentStatus.COMPLETED: "Rescue Completed",
}


class VolService:
    def __init__(self, db: Session):
        self.db = db

    def _load_assignment(
        self, assignment_id: uuid.UUID, volunteer: Volunteer, *, lock: bool = False
    ) -> VolunteerAssignment:
        stmt = (
            select(VolunteerAssignment)
            .where(VolunteerAssignment.id == assignment_id)
            .options(selectinload(VolunteerAssignment.report))
        )
        if lock:
            # Serialize concurrent transitions (accept/advance/complete) so a
            # double-submit can't pass the status guard twice and duplicate
            # timeline/notification rows or lose a metric update.
            stmt = stmt.with_for_update(of=VolunteerAssignment)
        a = self.db.scalars(stmt).first()
        if not a:
            raise NotFoundError("Assignment not found")
        if a.volunteer_id != volunteer.id:
            raise ForbiddenError("This assignment is not yours", code="not_your_assignment")
        return a

    def respond(self, volunteer: Volunteer, assignment_id: uuid.UUID, accept: bool, *, actor_id: uuid.UUID) -> VolunteerAssignment:
        a = self._load_assignment(assignment_id, volunteer, lock=True)
        if a.status != AssignmentStatus.ASSIGNED:
            raise ConflictError("This assignment has already been responded to", code="already_responded")
        a.status = AssignmentStatus.ACCEPTED if accept else AssignmentStatus.DECLINED
        a.responded_at = datetime.now(timezone.utc)
        report = a.report
        add_timeline_event(
            self.db, report_id=report.id,
            event_type="volunteer_accepted" if accept else "volunteer_declined",
            title="Volunteer Accepted" if accept else "Volunteer Declined",
            actor_id=actor_id, is_public=accept,
        )
        if accept and report.status == ReportStatus.VOLUNTEER_ASSIGNED:
            apply_status_transition(report, ReportStatus.VOLUNTEER_ACCEPTED)
        if report.claimed_by and report.claimed_by.owner_id:
            notify(
                self.db, user_id=report.claimed_by.owner_id,
                title=f"Volunteer {'accepted' if accept else 'declined'}",
                body=f"Case {report.tracking_id}",
                type_=NotificationType.SUCCESS if accept else NotificationType.WARNING,
            )
        record_audit(
            self.db, action="assignment.respond", actor_id=actor_id,
            entity_type="assignment", entity_id=str(a.id), meta={"accept": accept},
        )
        return a

    def advance(self, volunteer: Volunteer, assignment_id: uuid.UUID, target: AssignmentStatus, *, actor_id: uuid.UUID) -> VolunteerAssignment:
        if target == AssignmentStatus.COMPLETED:
            raise ValidationError(
                "Use the complete endpoint to finish a rescue", code="use_complete_endpoint"
            )
        a = self._load_assignment(assignment_id, volunteer, lock=True)
        expected = _ASSIGNMENT_FLOW.get(a.status)
        if expected != target:
            raise ValidationError(
                f"Cannot move assignment from '{a.status.value}' to '{target.value}'",
                code="invalid_transition",
            )
        a.status = target
        report = a.report
        new_report_status = _REPORT_STATUS_FOR.get(target)
        if new_report_status and report.claimed_by_ngo_id:
            # ARRIVED and IN_PROGRESS both map onto REACHED_LOCATION, so the
            # second one is a legitimate no-op rather than an illegal edge.
            apply_status_transition(report, new_report_status, allow_noop=True)
        add_timeline_event(
            self.db, report_id=report.id, event_type=new_report_status.value if new_report_status else target.value,
            title=_TIMELINE_TITLES.get(target, target.value.title()), actor_id=actor_id, is_public=True,
        )
        record_audit(
            self.db, action="assignment.advance", actor_id=actor_id,
            entity_type="assignment", entity_id=str(a.id), meta={"to": target.value},
        )
        return a

    def complete(
        self, volunteer: Volunteer, assignment_id: uuid.UUID, *,
        actor_id: uuid.UUID, notes: str | None, checklist: dict | None, hours: float | None,
    ) -> VolunteerAssignment:
        a = self._load_assignment(assignment_id, volunteer, lock=True)
        if a.status not in (AssignmentStatus.IN_PROGRESS, AssignmentStatus.ARRIVED):
            raise ValidationError("Assignment must be in progress to complete", code="invalid_transition")
        now = datetime.now(timezone.utc)
        report = a.report
        # Guard the report transition BEFORE mutating the assignment or the
        # volunteer's metrics: a CLOSED/REJECTED case must not be resurrected,
        # and a rejected completion must not leave counters incremented.
        if report.claimed_by_ngo_id:
            apply_status_transition(report, ReportStatus.RESCUE_COMPLETED)
            # Stamp a canonical completion time so analytics bucket it
            # correctly — once only, never overwriting an earlier stamp.
            if report.closed_at is None:
                report.closed_at = now
        a.status = AssignmentStatus.COMPLETED
        a.completed_at = now
        a.notes = sanitize_text(notes)
        if checklist is not None:
            a.checklist = json.dumps(checklist)
        # Update volunteer metrics.
        volunteer.completed_rescues += 1
        if hours:
            volunteer.total_hours += hours
        add_timeline_event(
            self.db, report_id=report.id, event_type="rescue_completed",
            title="Rescue Completed", description=notes, actor_id=actor_id, is_public=True,
        )
        if report.claimed_by and report.claimed_by.owner_id:
            notify(
                self.db, user_id=report.claimed_by.owner_id,
                title="Rescue completed", body=f"Case {report.tracking_id} marked complete by volunteer.",
                type_=NotificationType.SUCCESS,
            )
        record_audit(
            self.db, action="assignment.complete", actor_id=actor_id,
            entity_type="assignment", entity_id=str(a.id),
        )
        return a

    # --- Dashboard / performance ---

    def assignments_for(self, volunteer: Volunteer, statuses: list[AssignmentStatus] | None = None) -> list[VolunteerAssignment]:
        stmt = (
            select(VolunteerAssignment)
            .where(VolunteerAssignment.volunteer_id == volunteer.id)
            .options(selectinload(VolunteerAssignment.report))
            .order_by(VolunteerAssignment.created_at.desc())
        )
        if statuses:
            stmt = stmt.where(VolunteerAssignment.status.in_(statuses))
        return list(self.db.scalars(stmt).all())

    def acceptance_rate(self, volunteer: Volunteer) -> float:
        responded = self.db.scalar(
            select(func.count()).select_from(VolunteerAssignment).where(
                VolunteerAssignment.volunteer_id == volunteer.id,
                VolunteerAssignment.status != AssignmentStatus.ASSIGNED,
                VolunteerAssignment.status != AssignmentStatus.REMOVED,
            )
        ) or 0
        accepted = self.db.scalar(
            select(func.count()).select_from(VolunteerAssignment).where(
                VolunteerAssignment.volunteer_id == volunteer.id,
                VolunteerAssignment.status.notin_(
                    [AssignmentStatus.ASSIGNED, AssignmentStatus.DECLINED, AssignmentStatus.REMOVED]
                ),
            )
        ) or 0
        return round(accepted / responded, 3) if responded else 0.0

    @staticmethod
    def badges(volunteer: Volunteer) -> list[str]:
        out: list[str] = []
        if volunteer.completed_rescues >= 1:
            out.append("First Rescue")
        if volunteer.completed_rescues >= 10:
            out.append("Veteran Responder")
        if volunteer.completed_rescues >= 50:
            out.append("Lifesaver")
        if volunteer.total_hours >= 100:
            out.append("Century Club")
        return out
