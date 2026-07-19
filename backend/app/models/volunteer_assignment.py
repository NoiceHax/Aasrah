"""Volunteer assignment: links a volunteer to a report/case."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import AssignmentStatus

if TYPE_CHECKING:
    from app.models.report import Report
    from app.models.volunteer import Volunteer


class VolunteerAssignment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "volunteer_assignments"

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    volunteer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("volunteers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # NGO user who made the assignment.
    assigned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[AssignmentStatus] = mapped_column(
        Enum(AssignmentStatus, name="assignment_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=AssignmentStatus.ASSIGNED,
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Volunteer's own notes + a JSON-encoded checklist captured on completion.
    notes: Mapped[str | None] = mapped_column(Text)
    checklist: Mapped[str | None] = mapped_column(Text)

    report: Mapped[Report] = relationship(back_populates="assignments")
    volunteer: Mapped[Volunteer] = relationship(back_populates="assignments")

    __table_args__ = (
        # A volunteer can only have one active assignment row per report.
        UniqueConstraint("report_id", "volunteer_id", name="uq_assignment_report_volunteer"),
        Index("ix_assignment_status", "status"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<VolunteerAssignment vol={self.volunteer_id} report={self.report_id} {self.status.value}>"
