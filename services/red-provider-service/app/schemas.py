from pydantic import BaseModel, Field


class ProviderIdentityResponse(BaseModel):
    provider_code: str
    service_name: str
    api_base_url: str
    api_key_env_var: str
    secret_configured_elsewhere: bool


class NormalizedPointResponse(BaseModel):
    provider_code: str
    external_point_id: str
    normalized_point_id: str
    status: str
    reservation_ends_at: str | None = None
    price_per_kwh_eur: float | None = None
    capacity: int | None = None
    connector: str | None = None
    location_name: str | None = None
    address: str | None = None
    raw_payload: dict
    last_seen_at: str


class StatusResponse(BaseModel):
    provider_code: str
    external_point_id: str
    normalized_point_id: str
    status: str
    reservation_ends_at: str | None = None
    checked_at: str


class ReservationRequest(BaseModel):
    duration_minutes: int | None = Field(default=60, ge=1)


class NormalizedReservationResponse(BaseModel):
    provider_code: str
    external_point_id: str
    normalized_point_id: str
    provider_reservation_id: str | None = None
    status: str
    reservation_ends_at: str
    price_per_kwh_eur: float | None = None
    raw_payload: dict


class ProviderErrorResponse(BaseModel):
    provider_code: str
    error_type: str
    message: str
    external_status_code: int | None = None


class SyncSummaryResponse(BaseModel):
    provider_code: str
    status: str
    fetched_count: int
    upserted_count: int
    failed_count: int


class SyncRunResponse(BaseModel):
    id: str
    provider_code: str
    status: str
    started_at: str
    completed_at: str | None = None
    fetched_count: int
    upserted_count: int
    failed_count: int
    error_message: str | None = None
