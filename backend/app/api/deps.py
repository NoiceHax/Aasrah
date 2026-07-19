"""Shared API dependencies: DB session, current user, and role guards."""

from __future__ import annotations

from collections.abc import Iterable

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AuthError, ForbiddenError
from app.core.security import decode_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.repositories.user import UserRepository

# auto_error=False so we can raise our own structured 401.
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise AuthError("Authentication required", code="not_authenticated")

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Access token expired", code="token_expired") from exc
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid access token", code="invalid_token") from exc

    if payload.get("type") != "access":
        raise AuthError("Invalid token type", code="invalid_token")

    user = UserRepository(db).get(payload["sub"])
    if not user or not user.is_active:
        raise AuthError("Account is unavailable", code="account_disabled")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of raising when absent.

    Used by endpoints that behave differently for authenticated users but do
    not require auth (e.g. creating a report while optionally logged in).
    """
    if credentials is None or not credentials.credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except AuthError:
        return None


def require_roles(*roles: UserRole):
    """Dependency factory enforcing that the current user has one of `roles`."""

    allowed: Iterable[UserRole] = roles

    def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise ForbiddenError(
                "You do not have permission to perform this action",
                code="insufficient_role",
            )
        return user

    return _guard


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
