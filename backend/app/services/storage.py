"""Storage abstraction.

A `StorageBackend` interface decouples the app from where files live. The
local-disk implementation is used now; swapping to S3/R2/Cloudinary later is a
single new class plus a factory change; no call-site changes.
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import settings


class StorageBackend(ABC):
    @abstractmethod
    def save(self, data: bytes, *, subdir: str, ext: str) -> str:
        """Persist bytes and return an opaque storage key."""

    @abstractmethod
    def url_for(self, key: str) -> str:
        """Return a client-resolvable URL/path for a storage key."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove the object at `key` (no error if absent)."""

    @abstractmethod
    def open(self, key: str) -> bytes:
        """Read the raw bytes for `key`."""


class LocalStorageBackend(StorageBackend):
    """Stores files on the local filesystem under UPLOAD_DIR."""

    def __init__(self, base_dir: str | Path | None = None):
        self.base_dir = Path(base_dir or settings.UPLOAD_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # Prevent path traversal: keys are app-generated, but be defensive.
        # A string prefix test is not containment -- with base_dir
        # "/app/uploads", the resolved path "/app/uploads_evil/secret" starts
        # with the base string yet lives outside the directory. is_relative_to
        # compares path components, so only true descendants pass.
        path = (self.base_dir / key).resolve()
        if not path.is_relative_to(self.base_dir):
            raise ValueError("Invalid storage key")
        return path

    def save(self, data: bytes, *, subdir: str, ext: str) -> str:
        ext = ext.lstrip(".").lower()
        key = f"{subdir.strip('/')}/{uuid.uuid4().hex}.{ext}"
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def url_for(self, key: str) -> str:
        # Served by the authorized file endpoint (app/api/v1/files.py), never
        # by a static mount: the bytes are personal data and each read has to
        # go through the same ownership checks as the metadata.
        return f"{settings.API_V1_PREFIX}/files/{key}"

    def delete(self, key: str) -> None:
        try:
            self._path(key).unlink(missing_ok=True)
        except (ValueError, OSError):
            pass

    def open(self, key: str) -> bytes:
        return self._path(key).read_bytes()


_backend: StorageBackend | None = None


def get_storage() -> StorageBackend:
    """Storage backend singleton (factory point for swapping implementations)."""
    global _backend
    if _backend is None:
        _backend = LocalStorageBackend()
    return _backend
