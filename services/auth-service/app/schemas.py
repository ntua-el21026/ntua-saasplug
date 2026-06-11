from enum import StrEnum

from pydantic import BaseModel, Field


class Role(StrEnum):
    EV_USER = "EV_USER"
    PROVIDER_ADMIN = "PROVIDER_ADMIN"
    OPERATOR = "OPERATOR"


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=32)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=32)


class UserResponse(BaseModel):
    id: str
    email: str
    roles: list[str]
    provider_id: str | None = None
    provider_code: str | None = None


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class LogoutResponse(BaseModel):
    status: str


class GoogleOAuthStatus(BaseModel):
    status: str
    configured: bool
    message: str
    authorization_url: str | None = None
    code_received: bool | None = None
