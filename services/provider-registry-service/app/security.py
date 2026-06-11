from typing import Any

import jwt
from jwt import InvalidTokenError

from app.config import Settings, get_settings
from app.schemas import CurrentPrincipal

JWT_ALGORITHM = "HS256"


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


def principal_from_claims(claims: dict[str, Any]) -> CurrentPrincipal:
    sub = claims.get("sub")
    email = claims.get("email")
    roles = claims.get("roles")
    if not isinstance(sub, str) or not isinstance(email, str) or not isinstance(roles, list):
        raise ValueError("Invalid access token claims")
    if not all(isinstance(role, str) for role in roles):
        raise ValueError("Invalid access token claims")
    provider_id = claims.get("provider_id")
    provider_code = claims.get("provider_code")
    return CurrentPrincipal(
        sub=sub,
        email=email,
        roles=roles,
        provider_id=provider_id if isinstance(provider_id, str) else None,
        provider_code=provider_code if isinstance(provider_code, str) else None,
    )
