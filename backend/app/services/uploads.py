"""Shared upload helpers."""

from __future__ import annotations

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import ValidationError

_CHUNK = 64 * 1024


async def read_limited(file: UploadFile, max_bytes: int | None = None) -> bytes:
    """Read an upload in bounded chunks, aborting once the cap is exceeded.

    The Content-Length header is attacker-controllable, so this chunked read is
    the authoritative size guard; peak memory is bounded by `max_bytes`.
    """
    limit = max_bytes if max_bytes is not None else settings.max_upload_size_bytes
    buf = bytearray()
    while chunk := await file.read(_CHUNK):
        buf.extend(chunk)
        if len(buf) > limit:
            raise ValidationError(
                f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB limit",
                code="file_too_large",
            )
    return bytes(buf)
