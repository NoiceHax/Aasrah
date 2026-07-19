"""NGO profile + settings schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NgoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    focus_area: str | None
    location: str | None
    description: str | None
    is_verified: bool
    website: str | None
    contact_email: str | None
    contact_phone: str | None
    operating_hours: str | None
    emergency_contact: str | None
    shelter_locations: str | None
    logo_url: str | None = None
    service_latitude: float | None
    service_longitude: float | None
    service_radius_km: float
    created_at: datetime


class NgoUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    focus_area: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    description: str | None = None
    website: str | None = Field(default=None, max_length=255)
    contact_email: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=32)
    operating_hours: str | None = Field(default=None, max_length=255)
    emergency_contact: str | None = Field(default=None, max_length=255)
    shelter_locations: str | None = None
    service_latitude: float | None = Field(default=None, ge=-90, le=90)
    service_longitude: float | None = Field(default=None, ge=-180, le=180)
    service_radius_km: float | None = Field(default=None, gt=0, le=500)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_agent: str | None
    ip_address: str | None
    created_at: datetime
    expires_at: datetime
    revoked: bool
