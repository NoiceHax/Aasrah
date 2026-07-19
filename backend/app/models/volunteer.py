"""Volunteer model (placeholder for Phase 4, minimal fields established now)."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import VolunteerAssignmentMode, VolunteerStatus

if TYPE_CHECKING:
    from app.models.ngo import NGO
    from app.models.user import User
    from app.models.volunteer_assignment import VolunteerAssignment


class Volunteer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "volunteers"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    # Preferred NGO when assignment_mode is NGO_AFFILIATED (null = independent).
    ngo_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ngos.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # How the volunteer chooses to receive assignments. INDEPENDENT volunteers
    # are discoverable by any nearby verified NGO; NGO_AFFILIATED volunteers
    # primarily receive assignments from their preferred NGO (ngo_id).
    assignment_mode: Mapped[VolunteerAssignmentMode] = mapped_column(
        Enum(
            VolunteerAssignmentMode,
            name="volunteer_assignment_mode",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=VolunteerAssignmentMode.INDEPENDENT,
    )
    role_title: Mapped[str | None] = mapped_column(String(255))
    availability: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[VolunteerStatus] = mapped_column(
        Enum(VolunteerStatus, name="volunteer_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=VolunteerStatus.PENDING,
    )

    # Profile + metrics
    phone: Mapped[str | None] = mapped_column(String(32))
    skills: Mapped[str | None] = mapped_column(Text)  # comma-separated
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    completed_rescues: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating: Mapped[float | None] = mapped_column(Float)
    # Optional home location for nearby-volunteer discovery.
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    # Extended profile (Phase 4)
    certifications: Mapped[str | None] = mapped_column(Text)  # comma-separated
    languages: Mapped[str | None] = mapped_column(Text)  # comma-separated
    emergency_contact: Mapped[str | None] = mapped_column(String(255))
    working_radius_km: Mapped[float | None] = mapped_column(Float)
    schedule: Mapped[str | None] = mapped_column(Text)
    avatar_key: Mapped[str | None] = mapped_column(String(512))
    total_hours: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    user: Mapped[User] = relationship(back_populates="volunteer")
    ngo: Mapped[NGO | None] = relationship(back_populates="volunteers")
    assignments: Mapped[list["VolunteerAssignment"]] = relationship(
        back_populates="volunteer", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Volunteer user={self.user_id} status={self.status.value}>"
