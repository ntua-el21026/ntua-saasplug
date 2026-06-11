from enum import StrEnum

from pydantic import BaseModel, Field


class Role(StrEnum):
    EV_USER = "EV_USER"
    PROVIDER_ADMIN = "PROVIDER_ADMIN"
    OPERATOR = "OPERATOR"


class ProviderCode(StrEnum):
    redPlug = "redPlug"
    greenPlug = "greenPlug"
    bluePlug = "bluePlug"


class ProviderCreateRequest(BaseModel):
    provider_code: str = Field(min_length=2, max_length=32)
    display_name: str = Field(min_length=1, max_length=120)
    legal_name: str | None = Field(default=None, max_length=200)
    contact_email: str | None = Field(default=None, max_length=320)
    api_base_url: str = Field(min_length=1, max_length=500)
    api_key_env_var: str | None = Field(default=None, max_length=120)
    api_auth_type: str = Field(default="api_key", max_length=40)
    api_auth_header: str | None = Field(default="Authorization", max_length=120)
    timeout_seconds: int = Field(default=10, ge=1, le=120)
    is_active: bool = True


class ProviderUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    legal_name: str | None = Field(default=None, max_length=200)
    contact_email: str | None = Field(default=None, max_length=320)
    api_base_url: str | None = Field(default=None, min_length=1, max_length=500)
    api_key_env_var: str | None = Field(default=None, max_length=120)
    api_auth_type: str | None = Field(default=None, max_length=40)
    api_auth_header: str | None = Field(default=None, max_length=120)
    timeout_seconds: int | None = Field(default=None, ge=1, le=120)


class ProviderStatusRequest(BaseModel):
    is_active: bool


class ProviderResponse(BaseModel):
    id: str
    provider_code: str
    display_name: str
    legal_name: str | None
    contact_email: str | None
    api_base_url: str
    api_key_env_var: str | None
    api_auth_type: str
    api_auth_header: str | None
    timeout_seconds: int
    is_active: bool
    is_seeded: bool


class ProviderIntegrationConfigResponse(BaseModel):
    provider_code: str
    api_base_url: str
    api_key_env_var: str | None
    api_auth_type: str
    api_auth_header: str | None
    timeout_seconds: int
    is_active: bool
    secret_configured_elsewhere: bool


class AuditLogResponse(BaseModel):
    id: str
    provider_id: str
    provider_code: str
    actor_user_id: str | None
    actor_email: str | None
    actor_roles: list[str]
    action: str
    changed_fields: dict
    created_at: str


class CurrentPrincipal(BaseModel):
    sub: str
    email: str
    roles: list[str]
    provider_id: str | None = None
    provider_code: str | None = None
