"""Authentication endpoints."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import client_ip, get_current_user
from app.core.config import settings
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenPair,
)
from app.schemas.user import UserOut
from app.services.auth import AuthService
from app.services.email import templates as email_templates
from app.services.email.sender import queue_email

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    service = AuthService(db)
    user = service.register(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        phone=body.phone,
    )
    tokens = service.issue_tokens(
        user, user_agent=request.headers.get("user-agent"), ip=client_ip(request)
    )
    db.commit()
    queue_email(user.email, email_templates.welcome(user.full_name or "there"))
    return AuthResponse(user=UserOut.model_validate(user), tokens=tokens)


@router.post("/login", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    service = AuthService(db)
    user = service.authenticate(email=body.email, password=body.password)
    tokens = service.issue_tokens(
        user, user_agent=request.headers.get("user-agent"), ip=client_ip(request)
    )
    db.commit()
    return AuthResponse(user=UserOut.model_validate(user), tokens=tokens)


@router.post("/refresh", response_model=TokenPair)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def refresh(request: Request, body: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    service = AuthService(db)
    tokens = service.refresh(body.refresh_token)
    db.commit()
    return tokens


@router.post("/logout", response_model=MessageResponse)
def logout(body: LogoutRequest, db: Session = Depends(get_db)) -> MessageResponse:
    service = AuthService(db)
    service.logout(body.refresh_token)
    db.commit()
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def forgot_password(
    request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> ForgotPasswordResponse:
    service = AuthService(db)
    reset_token = service.create_reset_token(body.email)
    db.commit()
    # Email the reset link. We never reveal whether the email exists; in
    # development the token is also returned to make testing possible.
    if reset_token:
        reset_url = f"https://aasrah.org/reset-password?token={reset_token}"
        queue_email(body.email, email_templates.password_reset("there", reset_url))
    return ForgotPasswordResponse(
        message="If an account exists for that email, a reset link has been sent.",
        reset_token=reset_token if settings.DEBUG else None,
    )


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def reset_password(
    request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    service = AuthService(db)
    service.reset_password(token=body.token, new_password=body.new_password)
    db.commit()
    return MessageResponse(message="Password updated. Please sign in again.")
