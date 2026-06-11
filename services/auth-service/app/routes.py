from datetime import timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies import get_current_user, require_provider_admin_scope, require_roles
from app.models import RefreshToken, User, utcnow
from app.schemas import (
    AuthTokenResponse,
    GoogleOAuthStatus,
    LoginRequest,
    LogoutRequest,
    LogoutResponse,
    RefreshRequest,
    RegisterRequest,
    Role,
    UserResponse,
)
from app.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    normalize_email,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        roles=user.roles,
        provider_id=user.provider_id,
        provider_code=user.provider_code,
    )


def issue_tokens(db: Session, user: User, settings: Settings) -> AuthTokenResponse:
    refresh_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=utcnow() + timedelta(days=settings.jwt_refresh_token_expire_days),
        ),
    )
    db.commit()

    return AuthTokenResponse(
        access_token=create_access_token(user, settings),
        refresh_token=refresh_token,
        expires_in=settings.access_token_expires_in_seconds,
        user=user_response(user),
    )


def invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthTokenResponse:
    email = normalize_email(request.email)
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists",
        )

    user = User(
        email=email,
        password_hash=hash_password(request.password),
        roles=[Role.EV_USER.value],
        provider_id=None,
        provider_code=None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return issue_tokens(db, user, settings)


@router.post("/login", response_model=AuthTokenResponse)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthTokenResponse:
    email = normalize_email(request.email)
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active:
        raise invalid_credentials()
    if not verify_password(request.password, user.password_hash):
        raise invalid_credentials()
    return issue_tokens(db, user, settings)


@router.post("/refresh", response_model=AuthTokenResponse)
def refresh(
    request: RefreshRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthTokenResponse:
    refresh_token = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(request.refresh_token),
        ),
    )
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if refresh_token.revoked_at is not None or refresh_token.expires_at <= utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.get(User, refresh_token.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    return AuthTokenResponse(
        access_token=create_access_token(user, settings),
        refresh_token=request.refresh_token,
        expires_in=settings.access_token_expires_in_seconds,
        user=user_response(user),
    )


@router.post("/logout", response_model=LogoutResponse)
def logout(request: LogoutRequest, db: Session = Depends(get_db)) -> LogoutResponse:
    refresh_token = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(request.refresh_token),
        ),
    )
    if refresh_token is not None and refresh_token.revoked_at is None:
        refresh_token.revoked_at = utcnow()
        db.commit()
    return LogoutResponse(status="logged_out")


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return user_response(current_user)


@router.get("/require-operator", response_model=UserResponse)
def require_operator(
    current_user: User = Depends(require_roles(Role.OPERATOR)),
) -> UserResponse:
    return user_response(current_user)


@router.get("/require-provider-admin", response_model=UserResponse)
def require_provider_admin(
    current_user: User = Depends(require_provider_admin_scope),
) -> UserResponse:
    return user_response(current_user)


@router.get("/google/login", response_model=GoogleOAuthStatus)
def google_login(settings: Settings = Depends(get_settings)) -> GoogleOAuthStatus:
    if not settings.google_oauth_configured:
        return GoogleOAuthStatus(
            status="google_oauth_not_configured",
            configured=False,
            message="Google OAuth credentials are placeholders or missing in local demo mode.",
        )

    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
        },
    )
    return GoogleOAuthStatus(
        status="authorization_url_ready",
        configured=True,
        message="Google OAuth authorization URL is ready. Token exchange is deferred.",
        authorization_url=f"https://accounts.google.com/o/oauth2/v2/auth?{query}",
    )


@router.get("/google/callback", response_model=GoogleOAuthStatus)
def google_callback(
    code: str | None = None,
    settings: Settings = Depends(get_settings),
) -> GoogleOAuthStatus:
    if not settings.google_oauth_configured:
        return GoogleOAuthStatus(
            status="google_oauth_not_configured",
            configured=False,
            message="Google OAuth callback reached, but local demo credentials are not configured.",
        )
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google OAuth authorization code",
        )
    return GoogleOAuthStatus(
        status="token_exchange_not_implemented",
        configured=True,
        message="Authorization code received. Google token exchange is intentionally deferred.",
        code_received=True,
    )
