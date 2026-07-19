"""Web Push subscription (VAPID) for a user's browser/device."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class PushSubscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "push_subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "endpoint", name="uq_push_user_endpoint"),)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PushSubscription user={self.user_id}>"
