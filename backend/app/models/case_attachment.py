"""Case attachment: additional documents/photos uploaded by NGO staff."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.report import Report


class CaseAttachment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "case_attachments"

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    content_type: Mapped[str | None] = mapped_column(String(100))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    # Free-form category: rescue_photo, medical_doc, shelter_doc, proof_of_completion, other.
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="other")

    report: Mapped[Report] = relationship(back_populates="attachments")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<CaseAttachment {self.original_filename} report={self.report_id}>"
