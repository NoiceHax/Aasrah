"""NGO model (placeholder for Phase 3, minimal fields established now)."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.report import Report
    from app.models.user import User
    from app.models.volunteer import Volunteer


class NGO(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ngos"

    # Owning user account (the NGO admin). Nullable for seeded/placeholder NGOs.
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    focus_area: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Contact / profile
    website: Mapped[str | None] = mapped_column(String(255))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    contact_phone: Mapped[str | None] = mapped_column(String(32))
    operating_hours: Mapped[str | None] = mapped_column(String(255))
    emergency_contact: Mapped[str | None] = mapped_column(String(255))
    shelter_locations: Mapped[str | None] = mapped_column(Text)
    logo_key: Mapped[str | None] = mapped_column(String(512))

    # Service area: center + radius (km) used for nearby-report discovery.
    service_latitude: Mapped[float | None] = mapped_column(Float)
    service_longitude: Mapped[float | None] = mapped_column(Float)
    service_radius_km: Mapped[float] = mapped_column(Float, nullable=False, default=25.0)

    owner: Mapped[User | None] = relationship(back_populates="ngo")
    claimed_reports: Mapped[list[Report]] = relationship(back_populates="claimed_by")
    volunteers: Mapped[list[Volunteer]] = relationship(back_populates="ngo")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<NGO {self.name}>"
