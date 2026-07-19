"""Entity version history: append a JSON snapshot when a tracked object changes."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entity_version import EntityVersion


def snapshot(
    db: Session,
    *,
    entity_type: str,
    entity_id: uuid.UUID | str,
    change_kind: str,
    data: dict,
    actor_id: uuid.UUID | None = None,
) -> EntityVersion:
    """Record a new version for an entity. Version numbers are per-entity."""
    eid = str(entity_id)
    current_max = db.scalar(
        select(func.coalesce(func.max(EntityVersion.version), 0)).where(
            EntityVersion.entity_type == entity_type, EntityVersion.entity_id == eid
        )
    ) or 0
    ev = EntityVersion(
        entity_type=entity_type,
        entity_id=eid,
        version=current_max + 1,
        change_kind=change_kind,
        snapshot=data,
        actor_id=actor_id,
    )
    db.add(ev)
    return ev


def history(db: Session, entity_type: str, entity_id: uuid.UUID | str) -> list[EntityVersion]:
    stmt = (
        select(EntityVersion)
        .where(EntityVersion.entity_type == entity_type, EntityVersion.entity_id == str(entity_id))
        .order_by(EntityVersion.version.desc())
    )
    return list(db.scalars(stmt).all())
