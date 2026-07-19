"""Configurable automation rule (executed by the scheduler)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, TimestampMixin, UUIDMixin
from app.models.enums import AutomationTrigger


class AutomationRule(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "automation_rules"

    # Owning NGO (None = platform-wide rule managed by an admin).
    ngo_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ngos.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger: Mapped[AutomationTrigger] = mapped_column(
        Enum(AutomationTrigger, name="automation_trigger", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Rule knobs, e.g. {"threshold_minutes": 30, "radius_step_km": 10}.
    config: Mapped[dict | None] = mapped_column(JSONType)
    # How many minutes a report/condition must persist before the rule fires.
    threshold_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    run_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AutomationRule {self.trigger.value} enabled={self.enabled}>"
