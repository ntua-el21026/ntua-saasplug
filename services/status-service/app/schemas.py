from pydantic import BaseModel


class CurrentPrincipal(BaseModel):
    sub: str
    email: str
    roles: list[str]
    provider_id: str | None = None
    provider_code: str | None = None


class ProviderStatusDTO(BaseModel):
    provider_code: str
    external_point_id: str
    normalized_point_id: str
    status: str | None = None
    reservation_ends_at: str | None = None
    checked_at: str


class StatusLookupResponse(BaseModel):
    provider_code: str
    external_point_id: str
    normalized_point_id: str
    status: str
    reservation_ends_at: str | None
    checked_at: str
    expires_at: str
    cache_hit: bool
    provider_called: bool
    returned_stale: bool
    source: str
    warning: str | None = None


class StatusCacheResponse(BaseModel):
    provider_code: str
    external_point_id: str
    normalized_point_id: str
    status: str
    reservation_ends_at: str | None
    last_checked_at: str
    expires_at: str
    source: str
    last_error_type: str | None
    last_error_message: str | None


class StatusCheckLogResponse(BaseModel):
    id: str
    provider_code: str
    external_point_id: str
    normalized_point_id: str
    requested_by_user_id: str | None
    requested_by_email: str | None
    requested_by_roles: list[str]
    requested_by_provider_code: str | None
    cache_hit: bool
    force_refresh: bool
    result_status: str | None
    returned_stale: bool
    provider_called: bool
    provider_error_type: str | None
    provider_error_message: str | None
    external_status_code: int | None
    checked_at: str


class ProviderFreshnessResponse(BaseModel):
    provider_code: str
    cached_count: int
    valid_cache_count: int
    expired_cache_count: int
    last_checked_at: str | None
    last_log_status: str | None
    last_error_type: str | None
