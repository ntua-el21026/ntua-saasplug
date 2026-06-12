from pydantic import BaseModel, ConfigDict, Field


class CurrentPrincipal(BaseModel):
    sub: str
    email: str
    roles: list[str]
    provider_id: str | None = None
    provider_code: str | None = None


class ReservationCreateRequest(BaseModel):
    duration_minutes: int = Field(default=60, ge=1, le=1440)


class CatalogPointDTO(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    normalized_point_id: str
    provider_code: str
    external_point_id: str
    is_active: bool
    is_stale: bool


class ProviderReservationDTO(BaseModel):
    model_config = ConfigDict(extra="ignore")

    provider_code: str
    external_point_id: str
    normalized_point_id: str
    provider_reservation_id: str | None = None
    status: str
    reservation_ends_at: str
    price_per_kwh_eur: float | None = None
    raw_payload: dict = Field(default_factory=dict)


class ReservationResponse(BaseModel):
    id: str
    user_id: str
    user_email: str
    provider_code: str
    external_point_id: str
    normalized_point_id: str
    catalog_point_id: str | None
    requested_duration_minutes: int
    status: str
    provider_status: str | None
    provider_reservation_id: str | None
    reservation_ends_at: str | None
    price_per_kwh_eur: float | None
    failure_reason: str | None
    created_at: str
    updated_at: str


class ReservationAttemptResponse(BaseModel):
    id: str
    reservation_id: str | None
    user_id: str
    user_email: str
    requested_by_roles: list[str]
    requested_by_provider_code: str | None
    provider_code: str
    external_point_id: str
    normalized_point_id: str | None
    requested_duration_minutes: int
    provider_called: bool
    result_status: str
    provider_error_type: str | None
    provider_error_message: str | None
    external_status_code: int | None
    started_at: str
    completed_at: str | None


class OutboxEventResponse(BaseModel):
    id: str
    event_id: str
    event_type: str
    event_version: int
    correlation_id: str
    aggregate_id: str
    provider_code: str
    user_id: str
    occurred_at: str
    producer: str
    payload: dict
    publish_status: str
    publish_attempts: int
    last_publish_error: str | None
    last_publish_attempt_at: str | None
    published_at: str | None
    created_at: str


class OutboxPublishResponse(BaseModel):
    selected_count: int
    published_count: int
    failed_count: int
    skipped_count: int
    published_event_ids: list[str]
    failed_event_ids: list[str]
