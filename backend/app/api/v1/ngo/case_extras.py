"""Case internal notes + attachments (NGO-only)."""

import uuid

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, get_current_user
from app.api.ngo_deps import get_current_ngo
from app.core.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.db.session import get_db
from app.models.case_attachment import CaseAttachment
from app.models.internal_note import InternalNote
from app.models.ngo import NGO
from app.models.report import Report
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.case import AttachmentOut, NoteCreate, NoteOut
from app.services.audit import record_audit
from app.services.file_validation import sniff_file_type
from app.services.security_sanitize import sanitize_text
from app.services.storage import StorageBackend, get_storage
from app.services.uploads import read_limited

router = APIRouter(prefix="/ngo/cases", tags=["ngo:cases"])

_ALLOWED_ATTACHMENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_ATTACHMENT_CATEGORIES = {
    "rescue_photo", "medical_doc", "shelter_doc", "proof_of_completion", "other",
}


def _require_owned_case(db: Session, ngo: NGO, report_id: uuid.UUID) -> Report:
    report = db.get(Report, report_id)
    if not report:
        raise NotFoundError("Case not found")
    if report.claimed_by_ngo_id != ngo.id:
        raise ForbiddenError("This case is not assigned to your organization", code="not_your_case")
    return report


def _note_out(note: InternalNote) -> NoteOut:
    out = NoteOut.model_validate(note)
    out.author_name = note.author.full_name or note.author.email if note.author else None
    return out


# --- Internal notes ---

@router.get("/{report_id}/notes", response_model=list[NoteOut])
def list_notes(
    report_id: uuid.UUID,
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
) -> list[NoteOut]:
    _require_owned_case(db, ngo, report_id)
    stmt = (
        select(InternalNote)
        .where(InternalNote.report_id == report_id)
        .order_by(InternalNote.created_at.desc())
    )
    return [_note_out(n) for n in db.scalars(stmt).all()]


@router.post("/{report_id}/notes", response_model=NoteOut, status_code=201)
def create_note(
    request: Request,
    report_id: uuid.UUID,
    body: NoteCreate,
    ngo: NGO = Depends(get_current_ngo),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NoteOut:
    _require_owned_case(db, ngo, report_id)
    clean = sanitize_text(body.body)
    if not clean:
        raise ValidationError("Note body cannot be empty", code="empty_note")
    note = InternalNote(report_id=report_id, author_id=user.id, body=clean)
    db.add(note)
    record_audit(
        db, action="case.note_create", actor_id=user.id,
        entity_type="report", entity_id=str(report_id), ip_address=client_ip(request),
    )
    db.commit()
    db.refresh(note)
    return _note_out(note)


@router.patch("/{report_id}/notes/{note_id}", response_model=NoteOut)
def edit_note(
    report_id: uuid.UUID,
    note_id: uuid.UUID,
    body: NoteCreate,
    ngo: NGO = Depends(get_current_ngo),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NoteOut:
    _require_owned_case(db, ngo, report_id)
    note = db.get(InternalNote, note_id)
    if not note or note.report_id != report_id:
        raise NotFoundError("Note not found")
    if note.author_id != user.id:
        raise ForbiddenError("You can only edit your own notes", code="not_note_author")
    clean = sanitize_text(body.body)
    if not clean:
        raise ValidationError("Note body cannot be empty", code="empty_note")
    note.body = clean
    note.edited = True
    db.commit()
    db.refresh(note)
    return _note_out(note)


@router.delete("/{report_id}/notes/{note_id}", response_model=MessageResponse)
def delete_note(
    report_id: uuid.UUID,
    note_id: uuid.UUID,
    ngo: NGO = Depends(get_current_ngo),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    _require_owned_case(db, ngo, report_id)
    note = db.get(InternalNote, note_id)
    if not note or note.report_id != report_id:
        raise NotFoundError("Note not found")
    if note.author_id != user.id:
        raise ForbiddenError("You can only delete your own notes", code="not_note_author")
    db.delete(note)
    db.commit()
    return MessageResponse(message="Note deleted")


# --- Attachments ---

def _attachment_out(att: CaseAttachment, storage: StorageBackend) -> AttachmentOut:
    return AttachmentOut(
        id=att.id, report_id=att.report_id, url=storage.url_for(att.storage_key),
        original_filename=att.original_filename, content_type=att.content_type,
        size_bytes=att.size_bytes, category=att.category, created_at=att.created_at,
    )


@router.get("/{report_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(
    report_id: uuid.UUID,
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> list[AttachmentOut]:
    _require_owned_case(db, ngo, report_id)
    stmt = (
        select(CaseAttachment)
        .where(CaseAttachment.report_id == report_id)
        .order_by(CaseAttachment.created_at.desc())
    )
    return [_attachment_out(a, storage) for a in db.scalars(stmt).all()]


@router.post("/{report_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    request: Request,
    report_id: uuid.UUID,
    file: UploadFile = File(...),
    category: str = Form(default="other"),
    ngo: NGO = Depends(get_current_ngo),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> AttachmentOut:
    _require_owned_case(db, ngo, report_id)
    if category not in _ATTACHMENT_CATEGORIES:
        raise ValidationError(f"Invalid category: {category}", code="invalid_category")

    raw = await read_limited(file, settings.max_upload_size_bytes)
    if not raw:
        raise ValidationError("Empty file", code="empty_file")

    # Trust the bytes, not the client-declared content-type or filename. The
    # stored content-type and extension are derived from the sniffed type so a
    # spoofed header can't get e.g. an .html file saved and served inline.
    sniffed = sniff_file_type(raw)
    if sniffed is None:
        raise ValidationError(
            "Unsupported or unrecognized file type", code="unsupported_type"
        )
    content_type, ext = sniffed

    key = storage.save(raw, subdir=f"case-attachments/{report_id}", ext=ext)
    att = CaseAttachment(
        report_id=report_id, uploaded_by_id=user.id, storage_key=key,
        original_filename=file.filename, content_type=content_type,
        size_bytes=len(raw), category=category,
    )
    db.add(att)
    record_audit(
        db, action="case.attachment_upload", actor_id=user.id,
        entity_type="report", entity_id=str(report_id), ip_address=client_ip(request),
        meta={"category": category, "filename": file.filename},
    )
    db.commit()
    db.refresh(att)
    return _attachment_out(att, storage)


@router.delete("/{report_id}/attachments/{attachment_id}", response_model=MessageResponse)
def delete_attachment(
    report_id: uuid.UUID,
    attachment_id: uuid.UUID,
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> MessageResponse:
    _require_owned_case(db, ngo, report_id)
    att = db.get(CaseAttachment, attachment_id)
    if not att or att.report_id != report_id:
        raise NotFoundError("Attachment not found")
    storage.delete(att.storage_key)
    db.delete(att)
    db.commit()
    return MessageResponse(message="Attachment deleted")
