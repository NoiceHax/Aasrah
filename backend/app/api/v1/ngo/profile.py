"""NGO profile + settings endpoints."""

import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.ngo_deps import get_current_ngo
from app.api.v1.ngo.serializers import ngo_out
from app.core.config import settings
from app.core.exceptions import AuthError, ValidationError
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.ngo import NGO
from app.models.session import Session as AuthSession
from app.models.user import User
from app.repositories.session import SessionRepository
from app.schemas.auth import MessageResponse
from app.schemas.ngo import NgoOut, NgoUpdate, PasswordChange, SessionOut
from app.services.images import process_image
from app.services.storage import StorageBackend, get_storage
from app.services.uploads import read_limited

router = APIRouter(prefix="/ngo", tags=["ngo:profile"])


@router.get("/profile", response_model=NgoOut)
def get_profile(
    ngo: NGO = Depends(get_current_ngo),
    storage: StorageBackend = Depends(get_storage),
) -> NgoOut:
    return ngo_out(ngo, storage)


@router.patch("/profile", response_model=NgoOut)
def update_profile(
    body: NgoUpdate,
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> NgoOut:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(ngo, field, value)
    db.commit()
    db.refresh(ngo)
    return ngo_out(ngo, storage)


@router.post("/profile/logo", response_model=NgoOut)
async def upload_logo(
    file: UploadFile = File(...),
    ngo: NGO = Depends(get_current_ngo),
    db: Session = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> NgoOut:
    raw = await read_limited(file)
    if not raw:
        raise ValidationError("Empty file", code="empty_file")
    processed = process_image(raw, original_filename=file.filename)
    key = storage.save(processed.data, subdir=f"ngo-logos/{ngo.id}", ext=processed.ext)
    # Remove the previous logo if any.
    if ngo.logo_key:
        storage.delete(ngo.logo_key)
    ngo.logo_key = key
    db.commit()
    db.refresh(ngo)
    return ngo_out(ngo, storage)


# --- Settings ---

@router.post("/settings/password", response_model=MessageResponse)
def change_password(
    body: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if not verify_password(body.current_password, user.hashed_password):
        raise AuthError("Current password is incorrect", code="invalid_credentials")
    user.hashed_password = hash_password(body.new_password)
    # Revoke other sessions for safety.
    SessionRepository(db).revoke_all_for_user(user.id)
    db.commit()
    return MessageResponse(message="Password updated. Please sign in again on other devices.")


@router.get("/settings/sessions", response_model=list[SessionOut])
def list_sessions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SessionOut]:
    stmt = (
        select(AuthSession)
        .where(AuthSession.user_id == user.id, AuthSession.revoked.is_(False))
        .order_by(AuthSession.created_at.desc())
    )
    return [SessionOut.model_validate(s) for s in db.scalars(stmt).all()]


@router.delete("/settings/sessions/{session_id}", response_model=MessageResponse)
def revoke_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    repo = SessionRepository(db)
    s = repo.get(session_id)
    if s and s.user_id == user.id:
        s.revoked = True
        db.commit()
    return MessageResponse(message="Session revoked")
