"""Internal notes + case attachment schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    report_id: uuid.UUID
    author_id: uuid.UUID | None
    author_name: str | None = None
    body: str
    edited: bool
    created_at: datetime
    updated_at: datetime


class AttachmentOut(BaseModel):
    id: uuid.UUID
    report_id: uuid.UUID
    url: str
    original_filename: str | None
    content_type: str | None
    size_bytes: int | None
    category: str
    created_at: datetime
