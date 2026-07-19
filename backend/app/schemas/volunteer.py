"""Volunteer + assignment schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AssignmentStatus, VolunteerStatus


class VolunteerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str | None = None
    email: str | None = None
    phone: str | None
    role_title: str | None
    availability: str | None
    skills: list[str] = []
    status: VolunteerStatus
    is_available: bool
    completed_rescues: int
    rating: float | None
    active_assignments: int = 0


class VolunteerUpdate(BaseModel):
    role_title: str | None = Field(default=None, max_length=255)
    availability: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    skills: list[str] | None = None
    is_available: bool | None = None
    status: VolunteerStatus | None = None


class AssignmentCreate(BaseModel):
    volunteer_ids: list[uuid.UUID] = Field(min_length=1)


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    report_id: uuid.UUID
    volunteer_id: uuid.UUID
    volunteer_name: str | None = None
    assigned_by_id: uuid.UUID | None
    status: AssignmentStatus
    responded_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
