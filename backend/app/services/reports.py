"""Report service: creation, image attachment, and timeline derivation."""

from __future__ import annotations

from app.models.enums import ReportPriority, ReportStatus, SituationType
from app.models.report import Report
from app.models.report_image import ReportImage
from app.models.user import User
from app.repositories.report import ReportRepository
from app.schemas.report import ReportCreate, TimelineEvent
from app.services.images import process_image
from app.services.security_sanitize import sanitize_text
from app.services.storage import StorageBackend
from app.services.tracking import generate_tracking_id
from sqlalchemy.orm import Session

# Canonical citizen-facing rescue lifecycle (Phase 3 full workflow). The
# timeline shows these stages; actual timestamps come from real timeline events
# when present.
_LIFECYCLE: list[tuple[ReportStatus, str, str]] = [
    (ReportStatus.PENDING, "Report Received", "Your report was logged and assigned a tracking ID."),
    (ReportStatus.CLAIMED, "Claimed by NGO", "A verified NGO accepted the case."),
    (ReportStatus.VOLUNTEER_ASSIGNED, "Volunteer Assigned", "A responder has been assigned."),
    (ReportStatus.ON_ROUTE, "Responder En Route", "A responder is on the way."),
    (ReportStatus.REACHED_LOCATION, "Reached Location", "The responder has arrived."),
    (ReportStatus.RESCUE_COMPLETED, "Rescue Completed", "Immediate support has been delivered."),
    (ReportStatus.CLOSED, "Case Closed", "The case has been resolved and closed."),
]

# Maps each lifecycle stage to the statuses that count as having reached it,
# so intermediate states (e.g. volunteer_accepted) collapse onto a visible stage.
_STAGE_REACHED_BY: dict[ReportStatus, set[ReportStatus]] = {
    ReportStatus.PENDING: {ReportStatus.PENDING, ReportStatus.VERIFIED},
    ReportStatus.CLAIMED: {ReportStatus.CLAIMED},
    ReportStatus.VOLUNTEER_ASSIGNED: {
        ReportStatus.VOLUNTEER_ASSIGNED,
        ReportStatus.VOLUNTEER_ACCEPTED,
    },
    ReportStatus.ON_ROUTE: {ReportStatus.ON_ROUTE},
    ReportStatus.REACHED_LOCATION: {ReportStatus.REACHED_LOCATION},
    ReportStatus.RESCUE_COMPLETED: {
        ReportStatus.RESCUE_COMPLETED,
        ReportStatus.SHELTER_ASSIGNED,
        ReportStatus.RESOLVED,
    },
    ReportStatus.CLOSED: {ReportStatus.CLOSED},
}

# Rank each status by how far through the lifecycle it is.
_STATUS_STAGE_INDEX: dict[ReportStatus, int] = {}
for _idx, (_stage, _, _) in enumerate(_LIFECYCLE):
    for _st in _STAGE_REACHED_BY[_stage]:
        _STATUS_STAGE_INDEX[_st] = _idx


class ReportService:
    def __init__(self, db: Session, storage: StorageBackend):
        self.db = db
        self.storage = storage
        self.repo = ReportRepository(db)

    def create(self, data: ReportCreate, *, reporter: User | None) -> Report:
        tracking_id = generate_tracking_id(self.repo)
        report = Report(
            tracking_id=tracking_id,
            reporter_id=reporter.id if reporter else None,
            situation=data.situation,
            priority=data.priority,
            status=ReportStatus.PENDING,
            description=sanitize_text(data.description),
            address=sanitize_text(data.address),
            latitude=data.latitude,
            longitude=data.longitude,
            reporter_name=sanitize_text(data.reporter_name),
            reporter_phone=sanitize_text(data.reporter_phone),
            subject_is_minor=data.subject_is_minor,
        )

        # Child-safety pin. A human explicitly stating that the subject is a
        # child (or filing under child protection) outranks any inferred score:
        # under the JJ Act / POCSO this is mandatory-reporting territory, so the
        # case must not sit below CRITICAL. `priority_auto = False` stops the
        # background AI scorer from downgrading it later, and this override wins
        # over whatever `priority` the client sent.
        if data.subject_is_minor is True or data.situation == SituationType.CHILD_PROTECTION:
            report.priority = ReportPriority.CRITICAL
            report.priority_auto = False

        return self.repo.add(report)

    def attach_images(self, report: Report, files: list[tuple[bytes, str | None]]) -> None:
        """Process and persist images for a report. `files` = (bytes, filename)."""
        start = len(report.images)
        for idx, (raw, filename) in enumerate(files):
            processed = process_image(raw, original_filename=filename)
            key = self.storage.save(processed.data, subdir=report.tracking_id, ext=processed.ext)
            self.db.add(
                ReportImage(
                    report_id=report.id,
                    storage_key=key,
                    original_filename=filename,
                    content_type=processed.content_type,
                    size_bytes=processed.size_bytes,
                    width=processed.width,
                    height=processed.height,
                    position=start + idx,
                )
            )
        self.db.flush()

    def build_timeline(self, report: Report) -> list[TimelineEvent]:
        """Citizen-facing timeline: canonical stages with real timestamps
        overlaid from public timeline events, plus current-stage highlighting."""
        if report.status == ReportStatus.REJECTED:
            return [
                TimelineEvent(
                    key="submitted", title="Report Received",
                    description="Your report was logged.", state="complete",
                    timestamp=report.created_at,
                ),
                TimelineEvent(
                    key="rejected", title="Case Closed",
                    description="This report could not be actioned.", state="complete",
                    timestamp=report.updated_at,
                ),
            ]

        # Real public events keyed by the lifecycle status they map to.
        event_ts: dict[ReportStatus, object] = {ReportStatus.PENDING: report.created_at}
        for ev in getattr(report, "timeline_events", []) or []:
            if not ev.is_public:
                continue
            try:
                ev_status = ReportStatus(ev.event_type)
            except ValueError:
                continue
            stage_idx = _STATUS_STAGE_INDEX.get(ev_status)
            if stage_idx is not None:
                stage_status = _LIFECYCLE[stage_idx][0]
                event_ts.setdefault(stage_status, ev.created_at)

        current_idx = _STATUS_STAGE_INDEX.get(report.status, 0)

        events: list[TimelineEvent] = []
        for i, (status, title, desc) in enumerate(_LIFECYCLE):
            if i < current_idx:
                state = "complete"
            elif i == current_idx:
                state = "active"
            else:
                state = "upcoming"
            events.append(
                TimelineEvent(
                    key=status.value, title=title, description=desc,
                    state=state, timestamp=event_ts.get(status),
                )
            )
        return events
