"""Volunteer portal schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    AssignmentStatus,
    ReportPriority,
    ReportStatus,
    SituationType,
    VolunteerAssignmentMode,
    VolunteerStatus,
)


class VolProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str | None = None
    email: str | None = None
    phone: str | None
    role_title: str | None
    availability: str | None
    status: VolunteerStatus
    is_available: bool
    assignment_mode: VolunteerAssignmentMode
    ngo_id: uuid.UUID | None = None
    ngo_name: str | None = None
    skills: list[str] = []
    certifications: list[str] = []
    languages: list[str] = []
    emergency_contact: str | None
    working_radius_km: float | None
    schedule: str | None
    avatar_url: str | None = None
    completed_rescues: int
    total_hours: float
    rating: float | None


class VolProfileUpdate(BaseModel):
    phone: str | None = Field(default=None, max_length=32)
    role_title: str | None = Field(default=None, max_length=255)
    availability: str | None = Field(default=None, max_length=255)
    is_available: bool | None = None
    skills: list[str] | None = None
    certifications: list[str] | None = None
    languages: list[str] | None = None
    emergency_contact: str | None = Field(default=None, max_length=255)
    working_radius_km: float | None = Field(default=None, gt=0, le=500)
    schedule: str | None = Field(default=None, max_length=2000)


class VolAssignmentModeUpdate(BaseModel):
    """Set how the volunteer receives assignments.

    NGO_AFFILIATED requires ``ngo_id`` (the preferred NGO). INDEPENDENT clears
    any NGO association. Passing INDEPENDENT is also how a volunteer leaves
    their current NGO.
    """

    mode: VolunteerAssignmentMode
    ngo_id: uuid.UUID | None = None


class AssignmentReportInfo(BaseModel):
    id: uuid.UUID
    tracking_id: str
    situation: SituationType
    priority: ReportPriority
    status: ReportStatus
    address: str | None
    latitude: float | None
    longitude: float | None
    description: str


class VolAssignmentOut(BaseModel):
    id: uuid.UUID
    status: AssignmentStatus
    responded_at: datetime | None
    completed_at: datetime | None
    notes: str | None
    created_at: datetime
    report: AssignmentReportInfo


class VolDashboard(BaseModel):
    today: list[VolAssignmentOut]
    active: VolAssignmentOut | None
    upcoming: list[VolAssignmentOut]
    completed_count: int
    total_hours: float
    is_available: bool
    acceptance_rate: float


class CompleteAssignmentRequest(BaseModel):
    notes: str | None = Field(default=None, max_length=2000)
    checklist: dict[str, bool] | None = None
    hours: float | None = Field(default=None, ge=0, le=48)


class VolPerformance(BaseModel):
    total_rescues: int
    monthly_rescues: int
    acceptance_rate: float
    total_hours: float
    avg_response_minutes: float | None
    badges: list[str]
