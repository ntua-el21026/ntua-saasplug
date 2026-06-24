from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError

from app.config import Settings, get_settings
from app.schemas import CurrentPrincipal

JWT_ALGORITHM = "HS256"
bearer_scheme = HTTPBearer(auto_error=False)


def decode_access_token(token: str, settings: Settings | None = None) -> dict[str, Any]:
    active_settings = settings or get_settings()
    try:
        return jwt.decode(token, active_settings.jwt_secret, algorithms=[JWT_ALGORITHM])
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


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentPrincipal:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        return principal_from_claims(decode_access_token(credentials.credentials, settings))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


def ensure_log_reader(principal: CurrentPrincipal) -> None:
    if "OPERATOR" in principal.roles:
        return
    if "PROVIDER_ADMIN" in principal.roles and principal.provider_code:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")


def ensure_operator(principal: CurrentPrincipal) -> None:
    if "OPERATOR" not in principal.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operator role required")


def ensure_can_query_point_status(principal: CurrentPrincipal, provider_code: str) -> None:
    if "OPERATOR" in principal.roles or "EV_USER" in principal.roles:
        return
    if "PROVIDER_ADMIN" in principal.roles and principal.provider_code == provider_code:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provider scope mismatch")
