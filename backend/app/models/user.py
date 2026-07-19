"""User account model."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.ngo import NGO
    from app.models.report import Report
    from app.models.session import Session
    from app.models.volunteer import Volunteer


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(32))
    # CITIZEN is retained as a legacy enum value for historical rows but is no
    # longer assignable; the only public self-registration is VOLUNTEER, and
    # NGO/ADMIN accounts are provisioned by an administrator or seed script.
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=UserRole.VOLUNTEER,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    reports: Mapped[list[Report]] = relationship(back_populates="reporter")
    sessions: Mapped[list[Session]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    ngo: Mapped[NGO | None] = relationship(back_populates="owner", uselist=False)
    volunteer: Mapped[Volunteer | None] = relationship(back_populates="user", uselist=False)

    __table_args__ = (Index("ix_users_role", "role"),)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.email} ({self.role.value})>"
