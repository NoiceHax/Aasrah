"""Input sanitization helpers."""

from __future__ import annotations

import re

# Control characters except tab/newline/carriage-return.
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_text(value: str | None) -> str | None:
    """Strip control characters and trim surrounding whitespace.

    Defensive cleanup for free-text user input before persistence. Pydantic
    validates types/lengths; this removes injection-prone control bytes.
    """
    if value is None:
        return None
    return _CONTROL_CHARS.sub("", value).strip()
