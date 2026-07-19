"""Authentication service: registration, login, token refresh, password reset."""

from __future__ import annotations

from datetime import datetime, timezone

import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AuthError, ConflictError, NotFoundError
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.enums import UserRole, VolunteerStatus
from app.models.session import Session as AuthSession
from app.models.user import User
from app.models.volunteer import Volunteer
from app.repositories.session import SessionRepository
from app.repositories.user import UserRepository
from app.schemas.auth import TokenPair


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)
        self.sessions = SessionRepository(db)

    # --- Registration / login ---

    def register(
        self,
        *,
        email: str,
        password: str,
        full_name: str | None,
        phone: str | None,
    ) -> User:
        """Public self-registration. Always creates a VOLUNTEER account together
        with a PENDING volunteer profile; the account cannot access the
        volunteer portal until an administrator approves it. NGO and ADMIN
        accounts are never created here."""
        email = email.lower().strip()
        if self.users.get_by_email(email):
            raise ConflictError("An account with this email already exists", code="email_taken")
        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            phone=phone,
            role=UserRole.VOLUNTEER,
        )
        self.users.add(user)
        # A volunteer profile is created immediately in PENDING status. It
        # remains pending until an admin approves the application.
        self.db.add(
            Volunteer(
                user=user,
                phone=phone,
                status=VolunteerStatus.PENDING,
                is_available=False,
            )
        )
        self.db.flush()
        return user

    def authenticate(self, *, email: str, password: str) -> User:
        user = self.users.get_by_email(email.lower().strip())
        # Constant-ish failure path: same error whether user missing or bad password.
        if not user or not verify_password(password, user.hashed_password):
            raise AuthError("Invalid email or password", code="invalid_credentials")
        if not user.is_active:
            raise AuthError("This account is disabled", code="account_disabled")
        return user

    # --- Token issuance ---

    def issue_tokens(
        self, user: User, *, user_agent: str | None = None, ip: str | None = None
    ) -> TokenPair:
        access = create_access_token(str(user.id), user.role.value)
        refresh, jti = create_refresh_token(str(user.id))
        decoded = decode_token(refresh)
        self.sessions.add(
            AuthSession(
                user_id=user.id,
                refresh_token_jti=jti,
                expires_at=datetime.fromtimestamp(decoded["exp"], tz=timezone.utc),
                user_agent=user_agent,
                ip_address=ip,
            )
        )
        return TokenPair(access_token=access, refresh_token=refresh)

    def refresh(self, refresh_token: str) -> TokenPair:
        try:
            payload = decode_token(refresh_token)
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("Refresh token expired", code="token_expired") from exc
        except jwt.PyJWTError as exc:
            raise AuthError("Invalid refresh token", code="invalid_token") from exc

        if payload.get("type") != "refresh":
            raise AuthError("Invalid token type", code="invalid_token")

        jti = payload.get("jti")
        session = self.sessions.get_by_jti(jti) if jti else None
        if not session or session.revoked:
            raise AuthError("Refresh token has been revoked", code="token_revoked")

        user = self.users.get(session.user_id)
        if not user or not user.is_active:
            raise AuthError("Account is unavailable", code="account_disabled")

        # Rotate: revoke the old refresh token, issue a fresh pair.
        self.sessions.revoke_by_jti(jti)
        return self.issue_tokens(user, user_agent=session.user_agent, ip=session.ip_address)

    def logout(self, refresh_token: str) -> None:
        try:
            payload = decode_token(refresh_token)
        except jwt.PyJWTError:
            return  # Treat invalid token as already logged out.
        jti = payload.get("jti")
        if jti:
            self.sessions.revoke_by_jti(jti)

    # --- Password reset ---

    def create_reset_token(self, email: str) -> str | None:
        user = self.users.get_by_email(email.lower().strip())
        # Do not reveal whether the email exists.
        if not user:
            return None
        return create_password_reset_token(str(user.id))

    def reset_password(self, *, token: str, new_password: str) -> None:
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("Reset link expired", code="token_expired") from exc
        except jwt.PyJWTError as exc:
            raise AuthError("Invalid reset link", code="invalid_token") from exc

        if payload.get("type") != "reset":
            raise AuthError("Invalid token type", code="invalid_token")

        user = self.users.get(payload["sub"])
        if not user:
            raise NotFoundError("Account not found")

        user.hashed_password = hash_password(new_password)
        # Revoke all active sessions after a password change.
        self.sessions.revoke_all_for_user(user.id)
        self.db.flush()
