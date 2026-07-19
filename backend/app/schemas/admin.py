"""Admin console schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import (
    AnnouncementAudience,
    UserRole,
    VolunteerAssignmentMode,
    VolunteerStatus,
)


class AdminKpis(BaseModel):
    total_reports: int
    active_cases: int
    closed_cases: int
    registered_ngos: int
    registered_volunteers: int
    active_users: int
    pending_verifications: int
    pending_volunteers: int = 0


class AdminDashboard(BaseModel):
    kpis: AdminKpis
    report_trend: list[dict]
    user_growth: list[dict]
    recent_registrations: list[dict]
    heatmap: list[dict]


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime


class PaginatedUsers(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    page_size: int
    pages: int


class AdminNgoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    focus_area: str | None
    location: str | None
    is_verified: bool
    contact_email: str | None
    owner_id: uuid.UUID | None
    created_at: datetime


class AdminVolunteerOut(BaseModel):
    """A volunteer application/record as seen by an administrator."""

    id: uuid.UUID
    user_id: uuid.UUID
    name: str | None
    email: str | None
    phone: str | None
    status: VolunteerStatus
    assignment_mode: VolunteerAssignmentMode
    ngo_id: uuid.UUID | None
    ngo_name: str | None
    skills: list[str] = []
    completed_rescues: int
    created_at: datetime


class NgoCreate(BaseModel):
    """Admin-provisioned NGO account. Creates the NGO record plus an owner
    user account with the NGO role. There is no public NGO registration."""

    name: str = Field(min_length=1, max_length=255)
    owner_email: EmailStr
    owner_full_name: str | None = Field(default=None, max_length=255)
    # Admin sets a temporary password, communicated to the NGO out-of-band.
    temp_password: str = Field(min_length=8, max_length=128)
    focus_area: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    contact_email: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=32)
    service_latitude: float | None = Field(default=None, ge=-90, le=90)
    service_longitude: float | None = Field(default=None, ge=-180, le=180)
    service_radius_km: float = Field(default=25.0, gt=0, le=500)
    # Verify immediately on creation (admin-created NGOs are trusted).
    verified: bool = True


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1, max_length=5000)
    audience: AnnouncementAudience = AnnouncementAudience.EVERYONE
    pinned: bool = False


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: str
    audience: AnnouncementAudience
    pinned: bool
    published: bool
    created_at: datetime


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    entity_type: str | None
    entity_id: str | None
    ip_address: str | None
    created_at: datetime


class PaginatedAuditLogs(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    page_size: int
    pages: int
