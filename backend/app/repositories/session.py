"""Auth-session repository (refresh-token tracking)."""

from __future__ import annotations

from sqlalchemy import select

from app.models.session import Session as AuthSession
from app.repositories.base import BaseRepository


class SessionRepository(BaseRepository[AuthSession]):
    model = AuthSession

    def get_by_jti(self, jti: str) -> AuthSession | None:
        stmt = select(AuthSession).where(AuthSession.refresh_token_jti == jti)
        return self.db.scalars(stmt).first()

    def revoke_by_jti(self, jti: str) -> bool:
        session = self.get_by_jti(jti)
        if session and not session.revoked:
            session.revoked = True
            self.db.flush()
            return True
        return False

    def revoke_all_for_user(self, user_id) -> int:
        stmt = select(AuthSession).where(
            AuthSession.user_id == user_id, AuthSession.revoked.is_(False)
        )
        count = 0
        for s in self.db.scalars(stmt).all():
            s.revoked = True
            count += 1
        self.db.flush()
        return count
