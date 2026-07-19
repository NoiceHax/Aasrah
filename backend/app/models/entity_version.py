"""Entity version history: append-only snapshots of significant objects.

Captures a JSON snapshot of an entity's tracked fields whenever it changes, so
admins can inspect previous versions and restore data where appropriate.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, TimestampMixin, UUIDMixin


class EntityVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "entity_versions"

    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Who triggered the change (nullable for system actions).
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    change_kind: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. status_change
    # Full snapshot of tracked fields at this version.
    snapshot: Mapped[dict] = mapped_column(JSONType, nullable=False)

    __table_args__ = (
        Index("ix_entity_versions_entity", "entity_type", "entity_id", "version"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<EntityVersion {self.entity_type}:{self.entity_id} v{self.version}>"
