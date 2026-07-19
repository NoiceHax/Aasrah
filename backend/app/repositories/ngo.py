"""NGO + Volunteer repositories."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.models.ngo import NGO
from app.models.volunteer import Volunteer
from app.repositories.base import BaseRepository


class NgoRepository(BaseRepository[NGO]):
    model = NGO

    def get_by_owner(self, owner_id: uuid.UUID) -> NGO | None:
        stmt = select(NGO).where(NGO.owner_id == owner_id)
        return self.db.scalars(stmt).first()


class VolunteerRepository(BaseRepository[Volunteer]):
    model = Volunteer

    def get_by_user(self, user_id: uuid.UUID) -> Volunteer | None:
        stmt = select(Volunteer).where(Volunteer.user_id == user_id)
        return self.db.scalars(stmt).first()

    def list_for_ngo(self, ngo_id: uuid.UUID) -> list[Volunteer]:
        stmt = select(Volunteer).where(Volunteer.ngo_id == ngo_id)
        return list(self.db.scalars(stmt).all())
