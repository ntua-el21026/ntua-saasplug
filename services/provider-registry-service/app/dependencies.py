from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas import CurrentPrincipal, Role
from app.security import decode_access_token, principal_from_claims

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentPrincipal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        return principal_from_claims(decode_access_token(credentials.credentials))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
        ) from exc


def require_roles(*required_roles: Role) -> Callable[[CurrentPrincipal], CurrentPrincipal]:
    required_role_values = {role.value for role in required_roles}

    def dependency(
        principal: CurrentPrincipal = Depends(get_current_principal),
    ) -> CurrentPrincipal:
        if required_role_values.isdisjoint(set(principal.roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return principal

    return dependency


def ensure_provider_scope(principal: CurrentPrincipal, provider_code: str) -> None:
    if Role.OPERATOR.value in principal.roles:
        return
    if Role.PROVIDER_ADMIN.value in principal.roles and principal.provider_code == provider_code:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Provider scope denied",
    )


def ensure_operator(principal: CurrentPrincipal) -> None:
    if Role.OPERATOR.value not in principal.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator role required",
        )
