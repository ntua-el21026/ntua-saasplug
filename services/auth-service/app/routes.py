import base64
import hashlib
import json
import secrets
from datetime import timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies import get_current_user, require_provider_admin_scope, require_roles
from app.models import OAuthState, RefreshToken, User, utcnow
from app.schemas import (
    AuthTokenResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    GoogleLocalSignInRequest,
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

OAUTH_STATE_TTL_MINUTES = 10


def user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        roles=user.roles,
        provider_id=user.provider_id,
        provider_code=user.provider_code,
        auth_provider=user.auth_provider,
        last_login_method=user.last_login_method,
        password_change_supported=user.auth_provider == "local",
    )


def issue_tokens(db: Session, user: User, settings: Settings, login_method: str | None = None) -> AuthTokenResponse:
    if login_method:
        user.last_login_method = login_method
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


def oauth_state_digest(state: str) -> str:
    return hashlib.sha256(state.encode("utf-8")).hexdigest()


def generate_pkce_verifier() -> str:
    return secrets.token_urlsafe(64)[:128]


def pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def create_oauth_state(db: Session) -> tuple[str, str, str]:
    now = utcnow()
    db.query(OAuthState).filter(OAuthState.expires_at <= now, OAuthState.consumed_at.is_(None)).delete()
    state = secrets.token_urlsafe(32)
    verifier = generate_pkce_verifier()
    db.add(
        OAuthState(
            state_hash=oauth_state_digest(state),
            code_verifier=verifier,
            expires_at=now + timedelta(minutes=OAUTH_STATE_TTL_MINUTES),
        ),
    )
    db.commit()
    return state, verifier, pkce_challenge(verifier)


def consume_oauth_state(db: Session, state: str | None) -> str:
    if not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth state",
        )
    state_record = db.scalar(select(OAuthState).where(OAuthState.state_hash == oauth_state_digest(state)))
    now = utcnow()
    if state_record is None or state_record.consumed_at is not None or state_record.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )
    state_record.consumed_at = now
    db.commit()
    return state_record.code_verifier


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
        auth_provider="local",
        google_subject=None,
        last_login_method="local",
        roles=[Role.EV_USER.value],
        provider_id=None,
        provider_code=None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return issue_tokens(db, user, settings, login_method="local")


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
    if user.auth_provider == "google":
        raise invalid_credentials()
    if not verify_password(request.password, user.password_hash):
        raise invalid_credentials()
    return issue_tokens(db, user, settings, login_method="local")


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


@router.post("/password", response_model=ChangePasswordResponse)
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChangePasswordResponse:
    if current_user.auth_provider != "local":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password changes are available only for password sign-in accounts.",
        )
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    now = utcnow()
    current_user.password_hash = hash_password(request.new_password)
    current_user.last_login_method = "local"
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": now}, synchronize_session=False)
    db.commit()
    return ChangePasswordResponse(status="password_changed_relogin_required")


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
def google_login(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GoogleOAuthStatus:
    if not settings.google_oauth_configured:
        return GoogleOAuthStatus(
            status="google_oauth_not_configured",
            configured=False,
            message="Google OAuth credentials are placeholders or missing in local demo mode.",
        )

    state, verifier, challenge = create_oauth_state(db)
    _ = verifier
    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
    )
    return GoogleOAuthStatus(
        status="authorization_url_ready",
        configured=True,
        message="Google OAuth authorization URL is ready.",
        authorization_url=f"https://accounts.google.com/o/oauth2/v2/auth?{query}",
        state=state,
        code_challenge=challenge,
    )


@router.post("/google/local-sign-in", response_model=AuthTokenResponse)
def google_local_sign_in(
    request: GoogleLocalSignInRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthTokenResponse:
    if settings.google_oauth_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Local Google sign-in is disabled when real Google OAuth credentials are configured.",
        )
    return issue_google_sign_in(
        db=db,
        settings=settings,
        email=request.email,
        google_subject=f"local-demo:{normalize_email(request.email)}",
    )


@router.get("/google/callback")
def google_callback(
    code: str | None = None,
    error: str | None = None,
    state: str | None = None,
    redirect_uri: str | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    if not settings.google_oauth_configured:
        return GoogleOAuthStatus(
            status="google_oauth_not_configured",
            configured=False,
            message="Google OAuth callback reached, but local demo credentials are not configured.",
        )
    code_verifier = consume_oauth_state(db, state)
    if error is not None and redirect_uri is None:
        return RedirectResponse(f"{settings.google_frontend_callback_uri}#error={error}")
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google OAuth authorization code",
        )

    identity = fetch_google_identity(code, settings, redirect_uri=redirect_uri, code_verifier=code_verifier)
    auth_payload = issue_google_sign_in(
        db=db,
        settings=settings,
        email=identity["email"],
        google_subject=identity["sub"],
    )
    if redirect_uri is not None:
        return auth_payload
    return RedirectResponse(f"{settings.google_frontend_callback_uri}#payload={encode_auth_fragment_payload(auth_payload)}")


def encode_auth_fragment_payload(payload: AuthTokenResponse) -> str:
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload.model_dump(mode="json"), separators=(",", ":")).encode("utf-8"),
    )
    return encoded.decode("ascii").rstrip("=")


def issue_google_sign_in(db: Session, settings: Settings, email: str, google_subject: str) -> AuthTokenResponse:
    normalized_email = normalize_email(email)
    user = db.scalar(select(User).where(User.email == normalized_email))

    if user is not None:
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google sign-in is not available")
        if user.roles != [Role.EV_USER.value]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Google sign-in is available only for EV user accounts.",
            )
        if user.google_subject and user.google_subject != google_subject:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This Google account is already linked to a different identity.",
            )
        user.google_subject = google_subject
        return issue_tokens(db, user, settings, login_method="google")

    user = User(
        email=normalized_email,
        password_hash=hash_password(generate_refresh_token()),
        auth_provider="google",
        google_subject=google_subject,
        last_login_method="google",
        roles=[Role.EV_USER.value],
        provider_id=None,
        provider_code=None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return issue_tokens(db, user, settings, login_method="google")


def fetch_google_identity(
    code: str,
    settings: Settings,
    redirect_uri: str | None = None,
    code_verifier: str | None = None,
) -> dict[str, str]:
    token_payload = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": redirect_uri or settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }
    if code_verifier:
        token_payload["code_verifier"] = code_verifier
    try:
        with httpx.Client(timeout=10) as client:
            token_response = client.post("https://oauth2.googleapis.com/token", data=token_payload)
            token_response.raise_for_status()
            access_token = token_response.json().get("access_token")
            if not access_token:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google did not return an access token")
            userinfo_response = client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            userinfo_response.raise_for_status()
            userinfo = userinfo_response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google OAuth token exchange failed") from exc

    email = userinfo.get("email")
    subject = userinfo.get("sub")
    email_verified = userinfo.get("email_verified")
    if not email or not subject or email_verified is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account email could not be verified")
    return {"email": str(email), "sub": str(subject)}
