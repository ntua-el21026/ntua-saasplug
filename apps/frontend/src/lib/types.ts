export type Role = "EV_USER" | "PROVIDER_ADMIN" | "OPERATOR";

export interface User {
  id: string;
  email: string;
  roles: Role[];
  provider_id: string | null;
  provider_code: string | null;
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
  code_received?: boolean | null;
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

export interface CatalogPointListResponse {
  items: CatalogPoint[];
  total: number;
  limit: number;
  offset: number;
  bounds_applied: boolean;
  missing_coordinates_count: number;
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
}

export interface CatalogFilters {
  q: string;
  providerCode: "" | ProviderCode;
  status: "" | StatusValue;
  connector: string;
  includeStale: boolean;
}
