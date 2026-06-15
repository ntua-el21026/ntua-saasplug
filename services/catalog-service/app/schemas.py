from pydantic import BaseModel, Field


class CurrentPrincipal(BaseModel):
    sub: str
    email: str
    roles: list[str]
    provider_id: str | None = None
    provider_code: str | None = None


class CatalogPointResponse(BaseModel):
    id: str
    normalized_point_id: str
    provider_code: str
    external_point_id: str
    display_name: str
    location_name: str | None
    address: str | None
    latitude: float | None
    longitude: float | None
    coordinate_source: str
    status: str
    reservation_ends_at: str | None
    price_per_kwh_eur: float | None
    capacity: int | None
    connector: str | None
    is_active: bool
    is_stale: bool
    last_provider_seen_at: str
    last_catalog_sync_at: str


class CatalogPointDetailResponse(CatalogPointResponse):
    raw_provider_payload: dict


class CatalogSearchCircleResponse(BaseModel):
    center_lat: float
    center_lng: float
    radius_km: float


class CatalogPointListResponse(BaseModel):
    items: list[CatalogPointResponse]
    total: int
    limit: int
    offset: int
    bounds_applied: bool
    missing_coordinates_count: int
    search_circle: CatalogSearchCircleResponse | None = None


class ImportRunResponse(BaseModel):
    id: str
    provider_code: str
    status: str
    triggered_by: str | None
    started_at: str
    completed_at: str | None
    provider_sync_triggered: bool
    provider_fetched_count: int
    catalog_upserted_count: int
    catalog_changed_count: int
    catalog_marked_stale_count: int
    error_message: str | None


class ImportSummaryResponse(BaseModel):
    run_id: str
    provider_code: str
    status: str
    provider_sync_triggered: bool
    provider_fetched_count: int
    catalog_upserted_count: int
    catalog_changed_count: int
    catalog_marked_stale_count: int
    error_message: str | None = None


class ImportAllResponse(BaseModel):
    status: str
    providers: list[ImportSummaryResponse]


class ProviderFreshnessResponse(BaseModel):
    provider_code: str
    active_count: int
    stale_count: int
    last_successful_import_at: str | None
    last_import_status: str | None


class ProviderPointDTO(BaseModel):
    provider_code: str
    external_point_id: str
    normalized_point_id: str
    status: str | None = None
    reservation_ends_at: str | None = None
    price_per_kwh_eur: float | None = None
    capacity: int | None = None
    connector: str | None = None
    location_name: str | None = None
    address: str | None = None
    raw_payload: dict = Field(default_factory=dict)
    last_seen_at: str | None = None


class ProviderSyncSummaryDTO(BaseModel):
    provider_code: str
    status: str
    fetched_count: int = 0
    upserted_count: int = 0
    failed_count: int = 0
