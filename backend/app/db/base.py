"""SQLAlchemy declarative base and shared column/type conventions."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import JSON

# Portable JSON column: PG JSONB where available, plain JSON elsewhere (SQLite).
JSONType = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


class UUIDMixin:
    """Adds a UUID primary key.

    Postgres generates it server-side via gen_random_uuid(); a Python-side
    default is also supplied so the model works on any backend (e.g. SQLite in
    tests) without relying on a server function.
    """

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
        default=uuid.uuid4,
    )


class TimestampMixin:
    """Adds created_at / updated_at audit columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
