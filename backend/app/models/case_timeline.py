"""Case timeline event: append-only log of everything that happens to a report."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.report import Report


class CaseTimelineEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "case_timeline_events"

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Machine key (e.g. "claimed", "volunteer_assigned") + human title/description.
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Actor who triggered it (nullable for system/citizen events).
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Whether this event is safe to expose on the public tracking page.
    is_public: Mapped[bool] = mapped_column(default=True, nullable=False)

    report: Mapped[Report] = relationship(back_populates="timeline_events")

    __table_args__ = (Index("ix_case_timeline_report_created", "report_id", "created_at"),)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<CaseTimelineEvent {self.event_type} report={self.report_id}>"
