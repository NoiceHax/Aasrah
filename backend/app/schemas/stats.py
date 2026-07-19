"""Public statistics schema."""

import uuid

from pydantic import BaseModel


class PublicStats(BaseModel):
    total_reports: int
    rescues_completed: int
    verified_ngos: int
    active_volunteers: int


class PublicNgoOut(BaseModel):
    """A verified NGO as shown in the public directory (e.g. for a volunteer
    choosing a preferred organisation). No sensitive fields."""

    id: uuid.UUID
    name: str
    focus_area: str | None = None
    location: str | None = None
    website: str | None = None
