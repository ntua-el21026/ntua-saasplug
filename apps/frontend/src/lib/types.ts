export type Role = "EV_USER" | "PROVIDER_ADMIN" | "OPERATOR";

export interface User {
  id: string;
  email: string;
  roles: Role[];
  provider_id: string | null;
  provider_code: ProviderCode | null;
  auth_provider?: "local" | "google" | string;
  last_login_method?: "local" | "google" | string;
  password_change_supported?: boolean;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
}

export interface GoogleOAuthStatus {
  status: string;
  configured: boolean;
  message: string;
  authorization_url?: string | null;
  state?: string | null;
  code_challenge?: string | null;
  code_received?: boolean | null;
}

export interface ChangePasswordResponse {
  status: string;
}

export interface CatalogPoint {
  id: string;
  normalized_point_id: string;
  provider_code: ProviderCode;
  external_point_id: string;
  display_name: string;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinate_source: string;
  status: StatusValue;
  reservation_ends_at: string | null;
  price_per_kwh_eur: number | null;
  capacity: number | null;
  connector: string | null;
  is_active: boolean;
  is_stale: boolean;
  last_provider_seen_at: string;
  last_catalog_sync_at: string;
}

export interface CatalogPointDetail extends CatalogPoint {
  raw_provider_payload: Record<string, unknown>;
}

export interface CatalogSearchCircleResponse {
  center_lat: number;
  center_lng: number;
  radius_km: number;
}

export interface CatalogPointListResponse {
  items: CatalogPoint[];
  total: number;
  limit: number;
  offset: number;
  bounds_applied: boolean;
  missing_coordinates_count: number;
  search_circle?: CatalogSearchCircleResponse | null;
}

export interface ProviderFreshness {
  provider_code: ProviderCode;
  active_count: number;
  stale_count: number;
  last_successful_import_at: string | null;
  last_import_status: string | null;
}

export interface StatusLookupResponse {
  provider_code: ProviderCode;
  external_point_id: string;
  normalized_point_id: string;
  status: StatusValue;
  reservation_ends_at: string | null;
  checked_at: string;
  expires_at: string;
  cache_hit: boolean;
  provider_called: boolean;
  returned_stale: boolean;
  source: string;
  warning: string | null;
}

export interface StatusBatchLookupItem {
  provider_code: ProviderCode;
  external_point_id: string;
}

export interface StatusBatchLookupError {
  provider_code: ProviderCode;
  external_point_id: string;
  status: "unknown";
  error_type: string;
  message: string;
  external_status_code: number | null;
}

export interface StatusBatchLookupResponse {
  items: StatusLookupResponse[];
  errors: StatusBatchLookupError[];
}

export interface StatusCacheResponse {
  provider_code: ProviderCode;
  external_point_id: string;
  normalized_point_id: string;
  status: StatusValue;
  reservation_ends_at: string | null;
  last_checked_at: string;
  expires_at: string;
  source: string;
  last_error_type: string | null;
  last_error_message: string | null;
}

export interface Reservation {
  id: string;
  user_id: string;
  user_email: string;
  provider_code: ProviderCode;
  external_point_id: string;
  normalized_point_id: string;
  catalog_point_id: string | null;
  requested_duration_minutes: number;
  status: string;
  provider_status: string | null;
  provider_reservation_id: string | null;
  reservation_ends_at: string | null;
  price_per_kwh_eur: number | null;
  charger_capacity_kw: number | null;
  estimated_energy_kwh: number | null;
  estimated_cost_eur: number | null;
  estimated_cost_currency: string | null;
  estimate_basis: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type ProviderCode = "redPlug" | "greenPlug" | "bluePlug";

export type StatusValue = "available" | "charging" | "reserved" | "malfunction" | "offline" | "unknown";

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom: number;
  radiusKm: number;
}

export interface CatalogFilters {
  q: string;
  providerCode: "" | ProviderCode;
  status: "" | StatusValue;
  connector: string;
  includeStale: boolean;
}

export interface ProviderRecord {
  id: string;
  provider_code: ProviderCode;
  display_name: string;
  legal_name: string;
  contact_email: string;
  api_base_url: string;
  api_key_env_var: string | null;
  api_auth_type: string;
  api_auth_header: string | null;
  timeout_seconds: number;
  is_active: boolean;
  is_seeded: boolean;
}

export interface ProviderIntegrationConfig {
  provider_code: ProviderCode;
  api_base_url: string;
  api_auth_type: string;
  api_auth_header: string | null;
  api_key_env_var: string | null;
  timeout_seconds: number;
  secret_configured_elsewhere: boolean;
}

export interface ProviderAuditLog {
  id: string;
  provider_code: ProviderCode;
  actor_email: string | null;
  action: string;
  changed_fields: Record<string, unknown> | string[];
  created_at: string;
}

export interface CatalogImportRun {
  id: string;
  provider_code: ProviderCode;
  status: string;
  triggered_by: string | null;
  started_at: string;
  completed_at: string | null;
  provider_sync_triggered: boolean;
  provider_fetched_count: number;
  catalog_upserted_count: number;
  catalog_changed_count: number;
  catalog_marked_stale_count: number;
  error_message: string | null;
}

export interface CatalogImportSummary {
  run_id: string;
  provider_code: ProviderCode;
  status: string;
  provider_sync_triggered: boolean;
  provider_fetched_count: number;
  catalog_upserted_count: number;
  catalog_changed_count: number;
  catalog_marked_stale_count: number;
  error_message: string | null;
}

export interface CatalogImportAllResponse {
  status: string;
  providers: CatalogImportSummary[];
}

export interface StatusProviderFreshness {
  provider_code: ProviderCode;
  cached_count: number;
  valid_cache_count: number;
  expired_cache_count: number;
  last_checked_at: string | null;
  last_log_status: string | null;
  last_error_type: string | null;
}

export interface StatusCheckLog {
  id: string;
  provider_code: ProviderCode;
  external_point_id: string;
  normalized_point_id: string | null;
  status: StatusValue;
  source: string;
  cache_hit: boolean;
  provider_called: boolean;
  returned_stale: boolean;
  error_type: string | null;
  error_message: string | null;
  checked_at: string;
}

export interface PointMetric {
  provider_code: ProviderCode;
  internal_point_id: string | null;
  external_point_id: string | null;
  point_name: string | null;
  point_views: number;
  successful_reservations: number;
  failed_reservations: number;
  status_checks: number;
}

export interface AnalyticsFreshness {
  provider_code: ProviderCode | null;
  last_event_ingested_at: string | null;
  last_aggregate_computed_at: string | null;
  last_catalog_import_at: string | null;
  latest_catalog_import_status: string | null;
  analytics_delay_notice: string | null;
}

export interface EvReservationSummary {
  user_id: string;
  total_reservations: number;
  successful_reservations: number;
  failed_reservations: number;
  total_duration_minutes: number;
  distinct_points: number;
  estimated_reservations: number;
  missing_estimate_count: number;
  total_estimated_energy_kwh: number | null;
  total_estimated_cost_eur: number | null;
  average_estimated_cost_per_point_eur: number | null;
  average_estimated_cost_per_reservation_eur: number | null;
  currency: string | null;
  estimate_basis: string;
  last_event_ingested_at: string | null;
  last_aggregate_computed_at: string | null;
  analytics_delay_notice: string | null;
}

export interface ProviderDailyTrend {
  provider_code: ProviderCode;
  day_bucket: string;
  searches: number;
  point_views: number;
  status_checks: number;
  successful_reservations: number;
  failed_reservations: number;
  reservation_conversion_rate: number | null;
  observed_amount: number;
  currency: string | null;
}

export interface OperatorDailyTrend {
  day_bucket: string;
  total_searches: number;
  total_point_views: number;
  total_status_checks: number;
  successful_reservations: number;
  failed_reservations: number;
  global_conversion_rate: number | null;
}

export interface ProviderSummary {
  provider_code: ProviderCode;
  total_searches: number;
  total_point_views: number;
  total_status_checks: number;
  status_cache_hits: number;
  status_provider_calls: number;
  status_cache_hit_rate: number | null;
  successful_reservations: number;
  failed_reservations: number;
  reservation_conversion_rate: number | null;
  observed_amount: number;
  currency: string | null;
  top_viewed_points: PointMetric[];
  top_reserved_points: PointMetric[];
  status_distribution: Record<string, number>;
  data_freshness: AnalyticsFreshness | null;
  last_event_ingested_at: string | null;
  last_aggregate_computed_at: string | null;
}

export interface OperatorProviderComparison {
  provider_code: ProviderCode;
  total_searches: number;
  total_point_views: number;
  total_status_checks: number;
  successful_reservations: number;
  failed_reservations: number;
  observed_amount: number;
  reservation_conversion_rate: number | null;
}

export interface OperatorCatalogHealth {
  provider_code: ProviderCode;
  active_count: number;
  stale_count: number;
  last_successful_import_at: string | null;
  last_import_status: string | null;
}

export interface OperatorSummary {
  total_providers_seen: number;
  active_providers_seen: number;
  total_searches: number;
  total_point_views: number;
  total_status_checks: number;
  successful_reservations: number;
  failed_reservations: number;
  global_conversion_rate: number | null;
  provider_comparison: OperatorProviderComparison[];
  daily_trends: ProviderDailyTrend[];
  catalog_health: OperatorCatalogHealth[];
  last_event_ingested_at: string | null;
  last_aggregate_computed_at: string | null;
  analytics_delay_notice: string | null;
}

export interface AggregateRefreshResponse {
  usage_event_count: number;
  provider_hourly_rows: number;
  provider_daily_rows: number;
  point_daily_rows: number;
  provider_status_daily_rows: number;
  operator_daily_rows: number;
  ev_reservation_daily_rows: number;
  refreshed_at: string;
}

export interface QueueDrainResponse {
  requested_limit: number;
  received_count: number;
  ack_count: number;
  reject_count: number;
  requeue_count: number;
  created_count?: number;
  charged_count?: number;
  skipped_count?: number;
  duplicate_count?: number;
  unsupported_count?: number;
  failed_count?: number;
  invalid_count?: number;
}

export interface AnalyticsRefreshResponse {
  consumed: QueueDrainResponse;
  aggregates: AggregateRefreshResponse;
}

export interface ProviderBillingRefreshResponse {
  provider_code: ProviderCode;
  drained: QueueDrainResponse;
}

export interface SchedulerJob {
  id: string;
  job_key: string;
  description: string;
  target_service: string;
  target_url_path: string;
  http_method: string;
  schedule_type: string;
  interval_seconds: number | null;
  cron_expression: string | null;
  timezone: string;
  enabled: boolean;
  next_run_at: string | null;
  timeout_seconds: number;
  max_retries: number;
  retry_backoff_seconds: number;
  request_body: Record<string, unknown> | null;
  last_run_id: string | null;
  last_run_status: string | null;
  last_started_at: string | null;
  last_finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchedulerIntervalPresetResponse {
  preset: "minimum" | "defaults";
  updated_count: number;
  jobs: SchedulerJob[];
}

export interface StatusCachePolicy {
  ttl_seconds: number;
  minimum_ttl_seconds: number;
  default_ttl_seconds: number;
  updated_at: string;
}

export interface SchedulerRun {
  id: string;
  job_id: string;
  job_key: string;
  status: string;
  trigger_type: string;
  triggered_by_email: string | null;
  scheduler_instance_id: string;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  target_service: string;
  target_url_path: string;
  http_method: string;
  target_http_status: number | null;
  attempt_number: number;
  max_attempts: number;
  response_summary: Record<string, unknown> | null;
  error_type: string | null;
  error_message: string | null;
  correlation_id: string;
}

export interface SchedulerSequenceRun {
  sequence_key: string;
  status: "succeeded" | "completed_with_failures";
  ordered_job_keys: string[];
  runs: SchedulerRun[];
}

export interface SchedulerHealth {
  service: string;
  status: "healthy";
  enabled_job_count: number;
  total_job_count: number;
  running_job_count: number;
  last_run_status: string | null;
}

export interface PricingRule {
  id: string;
  provider_code: ProviderCode | null;
  name: string;
  active: boolean;
  currency: string;
  reservation_success_fee: number | string;
  point_view_fee: number | string;
  point_view_fee_enabled: boolean;
  reservation_failure_fee: number | string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Charge {
  id: string;
  provider_code: ProviderCode;
  charge_type: string;
  source_event_id: string;
  source_event_type: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  occurred_at: string;
  created_at: string;
}

export interface InvoiceLine {
  id: string;
  charge_id: string;
  description: string;
  amount: number;
  currency: string;
  source_event_id: string;
}

export interface MockPayment {
  id: string;
  invoice_id: string;
  provider_code: ProviderCode;
  amount: number;
  currency: string;
  status: string;
  mock_payment_reference: string | null;
  paid_by_email: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  provider_code: ProviderCode;
  invoice_number: string;
  period_start: string;
  period_end: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: string;
  issued_at: string | null;
  paid_at: string | null;
  created_by_email: string | null;
  lines: InvoiceLine[];
  payments: MockPayment[];
}

export interface BillingOverviewProviderRow {
  provider_code: ProviderCode;
  unpaid_amount: number;
  paid_amount: number;
  unbilled_amount: number;
  issued_invoice_count: number;
  paid_invoice_count: number;
  charge_count: number;
}

export interface BillingOverview {
  provider_code: ProviderCode | null;
  unpaid_amount: number;
  paid_amount: number;
  unbilled_amount: number;
  charge_count: number;
  unbilled_charge_count: number;
  invoiced_charge_count: number;
  paid_charge_count: number;
  issued_invoice_count: number;
  paid_invoice_count: number;
  currency: string;
  effective_pricing: PricingRule | null;
  provider_rows: BillingOverviewProviderRow[];
}
