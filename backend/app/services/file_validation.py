"""Magic-byte file type detection for attachment uploads.

Never trust the client-supplied multipart content-type or filename extension;
both are spoofable. We sniff the leading bytes, and the stored content-type +
extension are derived from the sniffed type via a server-controlled map.
"""

from __future__ import annotations

# Sniffed type -> (content_type, file extension). The extension is always
# server-controlled so an attacker can't get an `.html` saved and served inline.
_TYPE_MAP: dict[str, tuple[str, str]] = {
    "jpeg": ("image/jpeg", "jpg"),
    "png": ("image/png", "png"),
    "webp": ("image/webp", "webp"),
    "pdf": ("application/pdf", "pdf"),
    "docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
    ),
    "doc": ("application/msword", "doc"),
}


def sniff_file_type(data: bytes) -> tuple[str, str] | None:
    """Return (content_type, extension) from the file's magic bytes, or None
    if the bytes don't match a supported, allowed type."""
    if len(data) < 4:
        return None

    if data[:3] == b"\xff\xd8\xff":
        return _TYPE_MAP["jpeg"]
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return _TYPE_MAP["png"]
    if data[:4] == b"RIFF" and len(data) >= 12 and data[8:12] == b"WEBP":
        return _TYPE_MAP["webp"]
    if data[:5] == b"%PDF-":
        return _TYPE_MAP["pdf"]
    # OLE compound file (legacy .doc)
    if data[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        return _TYPE_MAP["doc"]
    # ZIP container: modern .docx (and other OOXML) start with PK\x03\x04.
    if data[:4] == b"PK\x03\x04":
        return _TYPE_MAP["docx"]
    return None
