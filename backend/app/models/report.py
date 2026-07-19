"""Citizen report model: the core entity of the platform."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, JSONType, TimestampMixin, UUIDMixin
from app.models.enums import ReportPriority, ReportStatus, SituationType

if TYPE_CHECKING:
    from app.models.case_attachment import CaseAttachment
    from app.models.case_timeline import CaseTimelineEvent
    from app.models.internal_note import InternalNote
    from app.models.ngo import NGO
    from app.models.report_image import ReportImage
    from app.models.user import User
    from app.models.volunteer_assignment import VolunteerAssignment


def _enum(py_enum: type, name: str) -> Enum:
    return Enum(py_enum, name=name, values_callable=lambda e: [m.value for m in e])


class Report(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "reports"

    # Human-friendly public tracking ID, e.g. "AR-9402". Unique + indexed.
    tracking_id: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)

    # Optional reporter; reports may be filed anonymously.
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    situation: Mapped[SituationType] = mapped_column(
        _enum(SituationType, "situation_type"), nullable=False
    )
    priority: Mapped[ReportPriority] = mapped_column(
        _enum(ReportPriority, "report_priority"), nullable=False, default=ReportPriority.MEDIUM
    )
    status: Mapped[ReportStatus] = mapped_column(
        _enum(ReportStatus, "report_status"), nullable=False, default=ReportStatus.PENDING
    )

    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Location
    address: Mapped[str | None] = mapped_column(String(512))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    # Reporter contact (denormalized; reports can be anonymous)
    reporter_name: Mapped[str | None] = mapped_column(String(255))
    reporter_phone: Mapped[str | None] = mapped_column(String(32))

    # Triage flags used by NGO discovery filters
    children_present: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    people_count: Mapped[int | None] = mapped_column(Integer)

    # Claiming NGO + lifecycle timestamps
    claimed_by_ngo_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ngos.id", ondelete="SET NULL"), nullable=True
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # AI assistance (Phase 5): advisory only; NGO staff can override.
    ai_summary: Mapped[str | None] = mapped_column(Text)
    ai_analysis: Mapped[dict | None] = mapped_column(JSONType)
    # Dynamic priority score 0-100 + the auto-derived priority before override.
    priority_score: Mapped[float | None] = mapped_column(Float)
    priority_auto: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Suggested duplicate-of (citizen-facing reports describing the same person).
    duplicate_of_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reports.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    reporter: Mapped[User | None] = relationship(back_populates="reports")
    images: Mapped[list[ReportImage]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="ReportImage.position"
    )
    claimed_by: Mapped[NGO | None] = relationship(back_populates="claimed_reports")
    timeline_events: Mapped[list["CaseTimelineEvent"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="CaseTimelineEvent.created_at"
    )
    assignments: Mapped[list["VolunteerAssignment"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )
    notes: Mapped[list["InternalNote"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="InternalNote.created_at"
    )
    attachments: Mapped[list["CaseAttachment"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_reports_status", "status"),
        Index("ix_reports_priority", "priority"),
        Index("ix_reports_created_at", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Report {self.tracking_id} ({self.status.value})>"
