from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_urlsafe
from typing import Any

import bcrypt
import jwt
from jwt import InvalidTokenError

from app.config import Settings, get_settings
from app.models import User

JWT_ALGORITHM = "HS256"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def generate_refresh_token() -> str:
    return token_urlsafe(48)


def hash_refresh_token(refresh_token: str) -> str:
    return sha256(refresh_token.encode("utf-8")).hexdigest()


def create_access_token(user: User, settings: Settings | None = None) -> str:
    active_settings = settings or get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=active_settings.jwt_access_token_expire_minutes,
    )
    payload: dict[str, Any] = {
        "sub": user.id,
        "email": user.email,
        "roles": user.roles,
        "provider_id": user.provider_id,
        "provider_code": user.provider_code,
        "exp": expires_at,
    }
    return jwt.encode(payload, active_settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str, settings: Settings | None = None) -> dict[str, Any]:
    active_settings = settings or get_settings()
    try:
        return jwt.decode(
            token,
            active_settings.jwt_secret,
            algorithms=[JWT_ALGORITHM],
        )
    except InvalidTokenError as exc:
        raise ValueError("Invalid access token") from exc
