"""Image validation and compression."""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.core.exceptions import ValidationError

# Pillow format -> output extension/content-type we re-encode to.
ALLOWED_INPUT_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_DIMENSION = 1920  # px on the longest edge after compression


@dataclass
class ProcessedImage:
    data: bytes
    ext: str
    content_type: str
    width: int
    height: int
    size_bytes: int


def process_image(raw: bytes, *, original_filename: str | None = None) -> ProcessedImage:
    """Validate, normalize orientation, downscale, and compress an image.

    Raises ValidationError on anything that isn't a supported image or that
    exceeds the configured size limit.
    """
    if len(raw) > settings.max_upload_size_bytes:
        raise ValidationError(
            f"Image exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB limit",
            code="file_too_large",
        )

    try:
        img = Image.open(io.BytesIO(raw))
        img.verify()  # detect truncated/corrupt files
        img = Image.open(io.BytesIO(raw))  # re-open; verify() leaves it unusable
    except (UnidentifiedImageError, OSError) as exc:
        raise ValidationError("File is not a valid image", code="invalid_image") from exc

    if img.format not in ALLOWED_INPUT_FORMATS:
        raise ValidationError(
            f"Unsupported image format: {img.format or 'unknown'}. "
            "Use JPEG, PNG, or WEBP.",
            code="unsupported_format",
        )

    # Respect EXIF orientation, then flatten to RGB for JPEG output.
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "P", "LA"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        rgb = img.convert("RGBA")
        background.paste(rgb, mask=rgb.split()[-1])
        img = background
    else:
        img = img.convert("RGB")

    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=82, optimize=True, progressive=True)
    data = out.getvalue()

    return ProcessedImage(
        data=data,
        ext="jpg",
        content_type="image/jpeg",
        width=img.width,
        height=img.height,
        size_bytes=len(data),
    )
