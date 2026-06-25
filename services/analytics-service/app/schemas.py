from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from saasplug_events.envelope import EventEnvelope


class CurrentPrincipal(BaseModel):
    sub: str
    email: str
    roles: list[str]
    provider_id: str | None = None
    provider_code: str | None = None


class IngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[EventEnvelope] = Field(min_length=1)


class IngestResultResponse(BaseModel):
    event_id: str
    event_type: str
    result: Literal["created", "duplicate", "unsupported"]
    message: str | None = None


class IngestResponse(BaseModel):
    created_count: int
    duplicate_count: int
    unsupported_count: int
    results: list[IngestResultResponse]


class ConsumeResponse(BaseModel):
    requested_limit: int
    received_count: int
    ack_count: int
    reject_count: int
    requeue_count: int
    created_count: int
    duplicate_count: int
    unsupported_count: int
    invalid_count: int


class AggregateRefreshResponse(BaseModel):
    usage_event_count: int
    provider_hourly_rows: int
    provider_daily_rows: int
    point_daily_rows: int
    provider_status_daily_rows: int
    operator_daily_rows: int
    ev_reservation_daily_rows: int
    refreshed_at: str


class AnalyticsRefreshResponse(BaseModel):
    consumed: ConsumeResponse
    aggregates: AggregateRefreshResponse


class PointMetricResponse(BaseModel):
    provider_code: str
    internal_point_id: str | None
    external_point_id: str | None
    point_name: str | None
    point_views: int
    successful_reservations: int
    failed_reservations: int
    status_checks: int


class FreshnessResponse(BaseModel):
    provider_code: str | None = None
    last_event_ingested_at: str | None
    last_aggregate_computed_at: str | None
    last_catalog_import_at: str | None
    latest_catalog_import_status: str | None
    analytics_delay_notice: str


class ProviderSummaryResponse(BaseModel):
    provider_code: str
    total_searches: int
    total_point_views: int
    total_status_checks: int
    status_cache_hits: int
    status_provider_calls: int
    status_cache_hit_rate: float | None
    successful_reservations: int
    failed_reservations: int
    reservation_conversion_rate: float | None
    observed_amount: float
    currency: str | None
    top_viewed_points: list[PointMetricResponse]
    top_reserved_points: list[PointMetricResponse]
    status_distribution: dict[str, int]
    data_freshness: FreshnessResponse
    last_event_ingested_at: str | None
    last_aggregate_computed_at: str | None


class ProviderDailyTrendResponse(BaseModel):
    provider_code: str
    day_bucket: str
    searches: int
    point_views: int
    status_checks: int
    successful_reservations: int
    failed_reservations: int
    reservation_conversion_rate: float | None
    observed_amount: float
    currency: str | None


class StatusDistributionResponse(BaseModel):
    provider_code: str
    status_distribution: dict[str, int]


class EvReservationSummaryResponse(BaseModel):
    user_id: str
    total_reservations: int
    successful_reservations: int
    failed_reservations: int
    total_duration_minutes: int
    distinct_points: int
    estimated_reservations: int
    missing_estimate_count: int
    total_estimated_energy_kwh: float | None
    total_estimated_cost_eur: float | None
    average_estimated_cost_per_point_eur: float | None
    average_estimated_cost_per_reservation_eur: float | None
    currency: str | None
    estimate_basis: str | None
    last_event_ingested_at: str | None
    last_aggregate_computed_at: str | None
    analytics_delay_notice: str


class OperatorSummaryResponse(BaseModel):
    total_providers_seen: int
    active_providers_seen: int
    total_searches: int
    total_point_views: int
    total_status_checks: int
    successful_reservations: int
    failed_reservations: int
    global_conversion_rate: float | None
    provider_comparison: list[dict[str, Any]]
    daily_trends: list[dict[str, Any]]
    catalog_health: list[dict[str, Any]]
    last_event_ingested_at: str | None
    last_aggregate_computed_at: str | None
    analytics_delay_notice: str


class ExportJobResponse(BaseModel):
    id: str
    actor_email: str
    actor_role: str
    actor_provider_code: str | None
    provider_code: str | None
    row_count: int
    created_at: str
