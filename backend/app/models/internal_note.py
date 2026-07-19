"""Internal note: NGO-only notes on a case. Never exposed to citizens."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.report import Report
    from app.models.user import User


class InternalNote(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "internal_notes"

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Stored as rich-text HTML/markdown produced by the editor.
    body: Mapped[str] = mapped_column(Text, nullable=False)
    edited: Mapped[bool] = mapped_column(default=False, nullable=False)

    report: Mapped[Report] = relationship(back_populates="notes")
    author: Mapped[User | None] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<InternalNote report={self.report_id} author={self.author_id}>"
