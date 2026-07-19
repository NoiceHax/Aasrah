"""Generic repository providing common persistence operations."""

from __future__ import annotations

import uuid
from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, db: Session):
        self.db = db

    def get(self, id_: uuid.UUID | str) -> ModelT | None:
        # Coerce string ids (e.g. JWT `sub`) to UUID so the Uuid column type
        # binds correctly on every backend (psycopg is lenient; SQLite is not).
        if isinstance(id_, str):
            try:
                id_ = uuid.UUID(id_)
            except ValueError:
                return None
        return self.db.get(self.model, id_)

    def list(self, *, limit: int = 50, offset: int = 0) -> list[ModelT]:
        stmt = select(self.model).limit(limit).offset(offset)
        return list(self.db.scalars(stmt).all())

    def add(self, instance: ModelT) -> ModelT:
        self.db.add(instance)
        self.db.flush()
        return instance

    def delete(self, instance: ModelT) -> None:
        self.db.delete(instance)
        self.db.flush()
