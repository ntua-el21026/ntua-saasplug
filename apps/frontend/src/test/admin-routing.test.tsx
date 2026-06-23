import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import type { Role, User } from "../lib/types";

const STORAGE_KEY = "saasplug.ev.session";

function userFor(role: Role): User {
  return {
    id: `${role.toLowerCase()}-id`,
    email: `${role.toLowerCase()}@saasplug.local`,
    roles: [role],
    provider_id: role === "PROVIDER_ADMIN" ? "red-provider-id" : null,
    provider_code: role === "PROVIDER_ADMIN" ? "redPlug" : null,
  };
}

function storeSession(role: Role) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      expiresAt: Date.now() + 60_000,
      user: userFor(role),
    }),
  );
}

function mockFetch(role: Role) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(raw, "http://app.test");
      const body = responseFor(url, role);
      return new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }),
  );
}

function responseFor(url: URL, role: Role): unknown {
  const pathname = url.pathname;
  if (pathname === "/api/auth/auth/me") {
    return userFor(role);
  }
  if (pathname === "/api/analytics/provider/summary") {
    return providerSummary();
  }
  if (pathname === "/api/analytics/provider/trends/daily") {
    return providerTrends();
  }
  if (pathname === "/api/analytics/provider/top-points") {
    return url.searchParams.get("metric") === "reservations" ? topReservedPoints() : topViewedPoints();
  }
  if (pathname === "/api/analytics/provider/freshness") {
    return analyticsFreshness();
  }
  if (pathname === "/api/billing/providers/redPlug/overview" || pathname === "/api/billing/overview") {
    return billingOverview();
  }
  if (pathname === "/api/billing/pricing/effective/redPlug") {
    return pricingRule();
  }
  if (pathname === "/api/billing/invoices") {
    return [];
  }
  if (pathname === "/api/catalog/points") {
    return catalogPointList(Number(url.searchParams.get("limit") ?? "25"));
  }
  if (pathname === "/api/catalog/points/redPlug/1515489") {
    return catalogPointDetail();
  }
  if (pathname === "/api/status/points/redPlug/1515489/status") {
    return statusLookup();
  }
  if (pathname === "/api/reservations/points/redPlug/1515489/reservations") {
    return reservationResponse();
  }
  if (pathname === "/api/catalog/freshness") {
    return [];
  }
  if (pathname === "/api/status/freshness") {
    return statusFreshnessRows();
  }
  if (pathname === "/api/analytics/operator/summary") {
    return operatorSummary();
  }
  if (pathname === "/api/analytics/operator/provider-comparison") {
    return operatorProviderComparison();
  }
  if (pathname === "/api/analytics/operator/trends/daily") {
    return operatorTrends();
  }
  if (pathname === "/api/analytics/operator/freshness") {
    return analyticsFreshness();
  }
  if (pathname === "/api/providers/providers") {
    return [];
  }
  if (pathname === "/api/providers/providers/redPlug") {
    return providerRecord();
  }
  if (pathname === "/api/providers/providers/redPlug/integration-config") {
    return providerIntegrationConfig();
  }
  if (pathname === "/api/providers/providers/redPlug/audit-logs") {
    return [providerAuditLog()];
  }
  if (pathname === "/api/catalog/imports/runs") {
    return catalogImportRuns();
  }
  if (pathname === "/api/scheduler/health") {
    return schedulerHealth();
  }
  if (pathname === "/api/scheduler/jobs") {
    return [schedulerJob(), invoicePreparationJob()];
  }
  if (pathname === "/api/scheduler/runs") {
    return [schedulerRun()];
  }
  if (pathname === "/api/scheduler/jobs/run-maintenance") {
    return {
      sequence_key: "maintenance.ordered",
      status: "succeeded",
      ordered_job_keys: [
        "catalog.import.all",
        "reservation.publish-outbox",
        "billing.drain-events",
        "billing.publish-outbox",
        "analytics.consume-events",
        "analytics.refresh-aggregates",
      ],
      runs: [schedulerRun()],
    };
  }
  if (pathname.endsWith("/health")) {
    return { status: "healthy" };
  }
  return {};
}

function providerSummary() {
  return {
    provider_code: "redPlug",
    total_searches: 18,
    total_point_views: 12,
    total_status_checks: 8,
    successful_reservations: 4,
    failed_reservations: 1,
    reservation_conversion_rate: null,
    observed_amount: 0,
    currency: null,
    top_viewed_points: topViewedPoints(),
    top_reserved_points: topReservedPoints(),
    status_distribution: { available: 5, reserved: 2, charging: 1 },
    data_freshness: null,
    last_event_ingested_at: null,
    last_aggregate_computed_at: null,
  };
}

function providerTrends() {
  return [
    {
      provider_code: "redPlug",
      day_bucket: "2026-06-21",
      searches: 8,
      point_views: 6,
      status_checks: 3,
      successful_reservations: 2,
      failed_reservations: 1,
      reservation_conversion_rate: 0.33,
      observed_amount: 1,
      currency: "EUR",
    },
    {
      provider_code: "redPlug",
      day_bucket: "2026-06-22",
      searches: 10,
      point_views: 6,
      status_checks: 5,
      successful_reservations: 2,
      failed_reservations: 0,
      reservation_conversion_rate: 0.33,
      observed_amount: 1,
      currency: "EUR",
    },
  ];
}

function operatorTrends() {
  return providerTrends().map((row) => ({
    day_bucket: row.day_bucket,
    total_searches: row.searches,
    total_point_views: row.point_views,
    total_status_checks: row.status_checks,
    successful_reservations: row.successful_reservations,
    failed_reservations: row.failed_reservations,
    global_conversion_rate: row.reservation_conversion_rate,
  }));
}

function topViewedPoints() {
  return [{
    provider_code: "redPlug",
    internal_point_id: "redPlug:1515489",
    external_point_id: "1515489",
    point_name: "Athens Central",
    point_views: 12,
    successful_reservations: 4,
    failed_reservations: 1,
    status_checks: 8,
  }];
}

function topReservedPoints() {
  return [{
    ...topViewedPoints()[0],
    point_name: "Piraeus Port",
    point_views: 9,
    successful_reservations: 6,
  }];
}

function analyticsFreshness() {
  return {
    provider_code: "redPlug",
    last_event_ingested_at: null,
    last_aggregate_computed_at: null,
    last_catalog_import_at: null,
    latest_catalog_import_status: null,
    analytics_delay_notice: "no_events_ingested",
  };
}

function providerRecord() {
  return {
    id: "red-provider-id",
    provider_code: "redPlug",
    display_name: "redPlug",
    legal_name: "Red Plug SA",
    contact_email: "red-admin@saasplug.local",
    api_base_url: "https://red.example.test",
    api_key_env_var: "RED_PROVIDER_API_KEY",
    api_auth_type: "api_key",
    api_auth_header: "Authorization",
    timeout_seconds: 10,
    is_active: true,
    is_seeded: true,
  };
}

function providerIntegrationConfig() {
  return {
    provider_code: "redPlug",
    api_base_url: "https://red.example.test",
    api_auth_type: "api_key",
    api_auth_header: "Authorization",
    api_key_env_var: "RED_PROVIDER_API_KEY",
    timeout_seconds: 10,
    is_active: true,
    secret_configured_elsewhere: true,
  };
}

function pricingRule() {
  return {
    id: "pricing-red",
    provider_code: "redPlug",
    name: "Default provider pricing",
    active: true,
    currency: "EUR",
    reservation_success_fee: "0.50",
    point_view_fee: "0.01",
    point_view_fee_enabled: true,
    reservation_failure_fee: "0.00",
    created_by_email: "operator@saasplug.local",
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  };
}

function providerAuditLog() {
  return {
    id: "audit-1",
    provider_id: "red-provider-id",
    provider_code: "redPlug",
    actor_user_id: "operator-id",
    actor_email: "operator@saasplug.local",
    actor_roles: ["OPERATOR"],
    action: "updated",
    changed_fields: {
      display_name: { old: "redPlug", new: "redPlug Athens" },
      is_active: { old: true, new: false },
    },
    created_at: "2026-06-13T00:00:00Z",
  };
}

function catalogPointDetail() {
  return {
    id: "catalog-red-1515489",
    normalized_point_id: "redPlug:1515489",
    provider_code: "redPlug",
    external_point_id: "1515489",
    display_name: "Owned redPlug charger",
    location_name: "Provider point",
    address: "Provider Street 1",
    latitude: 37.985,
    longitude: 23.78,
    coordinate_source: "demo_synthetic",
    status: "available",
    reservation_ends_at: null,
    price_per_kwh_eur: 0.31,
    capacity: 22,
    connector: "7",
    is_active: true,
    is_stale: false,
    last_provider_seen_at: "2026-06-13T00:00:00Z",
    last_catalog_sync_at: "2026-06-13T00:00:00Z",
    raw_provider_payload: {},
  };
}

function catalogPointList(limit: number) {
  const items = [
    catalogPointDetail(),
    {
      ...catalogPointDetail(),
      id: "catalog-green-201",
      normalized_point_id: "greenPlug:201",
      provider_code: "greenPlug",
      external_point_id: "201",
      display_name: "Foreign greenPlug charger",
      location_name: "Foreign provider point",
      address: "Green Street 1",
    },
  ];
  return {
    items: items.slice(0, limit),
    total: items.length,
    limit,
    offset: 0,
    bounds_applied: false,
    missing_coordinates_count: 0,
    search_circle: null,
  };
}

function statusLookup() {
  return {
    provider_code: "redPlug",
    external_point_id: "1515489",
    normalized_point_id: "redPlug:1515489",
    status: "available",
    reservation_ends_at: null,
    checked_at: "2026-06-13T00:00:00Z",
    expires_at: "2026-06-13T00:05:00Z",
    cache_hit: true,
    provider_called: false,
    returned_stale: false,
    source: "cache",
    warning: null,
  };
}

function reservationResponse() {
  return {
    id: "reservation-1",
    user_id: "ev-user-id",
    user_email: "evuser@saasplug.local",
    provider_code: "redPlug",
    external_point_id: "1515489",
    normalized_point_id: "redPlug:1515489",
    catalog_point_id: "catalog-red-1515489",
    requested_duration_minutes: 35,
    status: "succeeded",
    provider_status: "reserved",
    provider_reservation_id: "provider-reservation-1",
    reservation_ends_at: "2026-06-13T00:35:00Z",
    price_per_kwh_eur: 0.31,
    charger_capacity_kw: 22,
    estimated_energy_kwh: 12.83,
    estimated_cost_eur: 3.98,
    estimated_cost_currency: "EUR",
    estimate_basis: "cost_per_kwh_x_duration_x_capacity",
    failure_reason: null,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  };
}

function statusFreshnessRows() {
  return [
    {
      provider_code: "redPlug",
      cached_count: 2,
      valid_cache_count: 1,
      expired_cache_count: 1,
      last_checked_at: "2026-06-13T00:00:00Z",
      last_log_status: "succeeded",
      last_error_type: null,
    },
    {
      provider_code: "greenPlug",
      cached_count: 1,
      valid_cache_count: 1,
      expired_cache_count: 0,
      last_checked_at: "2026-06-13T00:00:00Z",
      last_log_status: "succeeded",
      last_error_type: null,
    },
  ];
}

function billingOverview() {
  return {
    provider_code: "redPlug",
    unpaid_amount: 0,
    paid_amount: 0,
    unbilled_amount: 0,
    charge_count: 0,
    unbilled_charge_count: 0,
    invoiced_charge_count: 0,
    paid_charge_count: 0,
    issued_invoice_count: 0,
    paid_invoice_count: 0,
    currency: "EUR",
    effective_pricing: pricingRule(),
    provider_rows: [],
  };
}

function operatorSummary() {
  return {
    total_providers_seen: 3,
    active_providers_seen: 3,
    total_searches: 18,
    total_point_views: 12,
    total_status_checks: 8,
    successful_reservations: 4,
    failed_reservations: 1,
    global_conversion_rate: 0.33,
    provider_comparison: operatorProviderComparison(),
    daily_trends: providerTrends(),
    catalog_health: [],
    last_event_ingested_at: null,
    last_aggregate_computed_at: null,
    analytics_delay_notice: null,
  };
}

function operatorProviderComparison() {
  return [
    {
      provider_code: "redPlug",
      total_searches: 18,
      total_point_views: 12,
      total_status_checks: 8,
      successful_reservations: 4,
      failed_reservations: 1,
      observed_amount: 2,
      reservation_conversion_rate: 0.33,
    },
    {
      provider_code: "greenPlug",
      total_searches: 12,
      total_point_views: 9,
      total_status_checks: 5,
      successful_reservations: 3,
      failed_reservations: 0,
      observed_amount: 1.5,
      reservation_conversion_rate: 0.33,
    },
  ];
}

function schedulerHealth() {
  return {
    service: "scheduler-service",
    status: "healthy",
    enabled_job_count: 8,
    total_job_count: 12,
    running_job_count: 0,
    last_run_status: "succeeded",
  };
}

function schedulerJob() {
  return {
    id: "job-1",
    job_key: "catalog.import.all",
    description: "Import all provider catalogs through catalog-service.",
    target_service: "catalog-service",
    target_url_path: "/internal/jobs/catalog/imports/all",
    http_method: "POST",
    schedule_type: "interval",
    interval_seconds: 86400,
    cron_expression: null,
    timezone: "UTC",
    enabled: true,
    next_run_at: null,
    timeout_seconds: 180,
    max_retries: 1,
    retry_backoff_seconds: 5,
    request_body: {},
    last_run_id: null,
    last_run_status: null,
    last_started_at: null,
    last_finished_at: null,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  };
}

function invoicePreparationJob() {
  return {
    ...schedulerJob(),
    id: "job-2",
    job_key: "billing.prepare-invoices",
    description: "Prepare invoice candidate summaries without issuing invoices.",
    target_service: "billing-service",
    target_url_path: "/internal/jobs/invoices/prepare",
    schedule_type: "cron",
    interval_seconds: null,
    cron_expression: "30 2 * * *",
    timezone: "Europe/Athens",
    next_run_at: "2026-06-24T02:30:00+03:00",
  };
}

function catalogImportRuns() {
  return [
    {
      id: "import-completed",
      provider_code: "greenPlug",
      status: "completed",
      triggered_by: "operator@saasplug.local",
      started_at: "2026-06-23T14:10:00Z",
      completed_at: "2026-06-23T14:10:10Z",
      provider_sync_triggered: true,
      provider_fetched_count: 509,
      catalog_upserted_count: 509,
      catalog_changed_count: 6,
      catalog_marked_stale_count: 0,
      error_message: null,
    },
    {
      id: "import-failed",
      provider_code: "redPlug",
      status: "failed",
      triggered_by: "operator@saasplug.local",
      started_at: "2026-06-23T14:08:00Z",
      completed_at: "2026-06-23T14:08:05Z",
      provider_sync_triggered: true,
      provider_fetched_count: 0,
      catalog_upserted_count: 0,
      catalog_changed_count: 0,
      catalog_marked_stale_count: 0,
      error_message: "Provider unavailable",
    },
  ];
}

function schedulerRun() {
  return {
    id: "run-1",
    job_id: "job-1",
    job_key: "catalog.import.all",
    status: "succeeded",
    trigger_type: "manual",
    triggered_by_email: "operator@saasplug.local",
    scheduler_instance_id: "scheduler-service-1",
    queued_at: "2026-06-13T00:00:00Z",
    started_at: "2026-06-13T00:00:01Z",
    finished_at: "2026-06-13T00:00:02Z",
    duration_ms: 1000,
    target_service: "catalog-service",
    target_url_path: "/internal/jobs/catalog/imports/all",
    http_method: "POST",
    target_http_status: 200,
    attempt_number: 1,
    max_attempts: 2,
    response_summary: null,
    error_type: null,
    error_message: null,
    correlation_id: "correlation-1",
  };
}

describe("admin role routing", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("redirects provider admins to the provider dashboard", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /your network overview/i })).toBeInTheDocument();
    expect(await screen.findByText(/daily successful reservations across your charging network/i)).toBeInTheDocument();
    expect(screen.getByText(/latest invoices and payment status/i)).toBeInTheDocument();
    expect(screen.queryByText(/analytics aggregate cache/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/billing-service/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provider workspace/i)).not.toBeInTheDocument();
  });

  it("renders provider analytics when aggregates do not yet have a currency", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/provider/analytics");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /^your performance$/i })).toBeInTheDocument();
    expect(await screen.findByText("€0.00")).toBeInTheDocument();
    expect(screen.getByText("Red provider admin")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /provider activity bar chart/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /status distribution/i }));
    expect(await screen.findByRole("img", { name: /charging point status distribution/i })).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /top reserved points/i }));
    expect(await screen.findByText("Piraeus Port")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /successful reservations bar chart/i })).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /conversion rate/i }));
    expect(await screen.findByRole("img", { name: /reservation conversion bar chart/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /tracked revenue/i }));
    expect(await screen.findByRole("img", { name: /tracked revenue bar chart/i })).toBeInTheDocument();

    await waitFor(() => {
      const topPointCalls = vi.mocked(fetch).mock.calls.filter(([input]) => {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return new URL(raw, "http://app.test").pathname === "/api/analytics/provider/top-points";
      });
      expect(topPointCalls).toHaveLength(2);
    });
  });

  it("scopes provider point inventory to the signed-in provider", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/provider/points");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /^your charging points$/i })).toBeInTheDocument();
    expect(await screen.findByText("Owned redPlug charger")).toBeInTheDocument();
    expect(screen.queryByText("Foreign greenPlug charger")).not.toBeInTheDocument();
    expect(screen.queryByText("greenPlug")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/entries fetched/i), "40");
    await waitFor(() => {
      const catalogCall = [...vi.mocked(fetch).mock.calls].reverse().find(([input]) => {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return new URL(raw, "http://app.test").pathname === "/api/catalog/points";
      });
      expect(catalogCall).toBeDefined();
      const raw = String(catalogCall?.[0]);
      const url = new URL(raw, "http://app.test");
      expect(url.searchParams.get("providerCode")).toBe("redPlug");
      expect(url.searchParams.get("limit")).toBe("40");
    });
  });

  it("allows provider admins to open their own point details without reservation controls", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/points/redPlug/1515489");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /owned redplug charger/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /charging point details/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /reservation availability/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create reservation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /access denied/i })).not.toBeInTheDocument();
  });

  it("lets EV users replace reservation duration and close the reservation result", async () => {
    storeSession("EV_USER");
    mockFetch("EV_USER");
    window.history.pushState({}, "", "/points/redPlug/1515489");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /owned redplug charger/i })).toBeInTheDocument();
    const durationInput = screen.getByLabelText(/duration in minutes/i);
    await userEvent.clear(durationInput);
    expect(durationInput).toHaveValue(null);
    await userEvent.type(durationInput, "35");
    expect(durationInput).toHaveValue(35);

    await userEvent.click(screen.getByRole("button", { name: /create reservation/i }));

    expect(await screen.findByText(/reservation succeeded/i)).toBeInTheDocument();
    await waitFor(() => {
      const reservationCall = vi.mocked(fetch).mock.calls.find(([input, options]) => {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return new URL(raw, "http://app.test").pathname === "/api/reservations/points/redPlug/1515489/reservations"
          && options?.method === "POST";
      });
      expect(reservationCall).toBeDefined();
      expect(JSON.parse(String(reservationCall?.[1]?.body))).toEqual({ duration_minutes: 35 });
    });

    await userEvent.click(screen.getByRole("button", { name: /close reservation status/i }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /reservation status/i })).not.toBeInTheDocument());
  });

  it("blocks provider admins from opening another provider point detail", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/points/greenPlug/1515489");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument());
  });

  it("renders provider settings audit fields returned as a backend object", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/provider/settings");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /^your settings$/i })).toBeInTheDocument();
    expect(await screen.findByText("display_name, is_active")).toBeInTheDocument();
    expect(screen.getByText("Default provider pricing")).toBeInTheDocument();
    expect(screen.getByText("redPlug override")).toBeInTheDocument();
    expect(screen.getByText("€0.50")).toBeInTheDocument();
    expect(screen.getByText("€0.01")).toBeInTheDocument();
    expect(screen.queryByText("Not available")).not.toBeInTheDocument();
  });

  it("renders the provider-admin profile without leaving the workspace shell blank", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/profile");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /provider_admin@saasplug.local/i })).toBeInTheDocument();
    expect(screen.getByText("redPlug")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open provider workspace/i })).toHaveAttribute("href", "/provider/dashboard");
  });

  it("redirects operators to the operator dashboard", async () => {
    storeSession("OPERATOR");
    mockFetch("OPERATOR");
    window.history.pushState({}, "", "/");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /operator command center/i })).toBeInTheDocument();
    expect(screen.queryByText(/operator workspace/i)).not.toBeInTheDocument();
  });

  it("browses operator analytics diagrams through shared tabs", async () => {
    storeSession("OPERATOR");
    mockFetch("OPERATOR");
    window.history.pushState({}, "", "/operator/analytics");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /operator analytics/i })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /platform activity bar chart/i })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("tab", { name: /provider reservations/i }));
    expect(await screen.findByRole("img", { name: /successful reservations bar chart/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /provider conversion/i }));
    expect(await screen.findByRole("img", { name: /conversion percent bar chart/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /comparison table/i }));
    expect(await screen.findByRole("heading", { name: /provider comparison/i })).toBeInTheDocument();
  });

  it("uses tabs for operator catalog inventory, coverage, and runs", async () => {
    storeSession("OPERATOR");
    mockFetch("OPERATOR");
    window.history.pushState({}, "", "/operator/catalog");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /catalog and sync controls/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /catalog points/i })).toBeInTheDocument();
    const pageSizeSelect = screen.getByLabelText(/results fetched/i);
    expect(pageSizeSelect).toHaveValue("25");
    expect(screen.getByRole("heading", { name: /point status guide/i })).toBeInTheDocument();
    await userEvent.selectOptions(pageSizeSelect, "50");
    await waitFor(() => {
      const pointCalls = vi.mocked(fetch).mock.calls.filter(([input]) => {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const url = new URL(raw, "http://app.test");
        return url.pathname === "/api/catalog/points" && url.searchParams.get("limit") === "50";
      });
      expect(pointCalls.length).toBeGreaterThan(0);
    });
    await userEvent.click(screen.getByRole("tab", { name: /coverage health/i }));
    expect(await screen.findByRole("heading", { name: /catalog coverage health/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /import runs/i }));
    expect(await screen.findByRole("heading", { name: /import runs/i })).toBeInTheDocument();
    const completedBadges = screen
      .getAllByText(/^completed$/i)
      .filter((element) => element.classList.contains("ui-status-badge"));
    expect(completedBadges[0]).toHaveClass("ui-tone-success");
  });

  it("blocks EV users from provider-admin routes", async () => {
    storeSession("EV_USER");
    mockFetch("EV_USER");
    window.history.pushState({}, "", "/provider/dashboard");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument());
  });

  it("renders scheduler controls for operators", async () => {
    storeSession("OPERATOR");
    mockFetch("OPERATOR");
    window.history.pushState({}, "", "/operator/sync");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /scheduler control plane/i })).toBeInTheDocument();
    expect((await screen.findAllByText(/import all provider catalogs/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/fetch the latest charging points/i)).toBeInTheDocument();
    expect(screen.getByText(/prepare invoice previews/i)).toBeInTheDocument();
    expect(screen.getByText(/daily at 02:30/i)).toBeInTheDocument();
    expect(screen.queryByText(/billing prepare-invoices/i)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("86400")).toBeInTheDocument();
    expect(screen.getAllByText(/^s$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/every day/i)).toBeInTheDocument();
  });

  it("lets operators update an interval job schedule", async () => {
    storeSession("OPERATOR");
    mockFetch("OPERATOR");
    window.history.pushState({}, "", "/operator/sync");

    render(<App />);

    const intervalInput = await screen.findByLabelText(/catalog\.import\.all interval seconds/i);
    fireEvent.change(intervalInput, { target: { value: "172800" } });
    const form = intervalInput.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/scheduler/jobs/catalog.import.all",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    const patchCalls = vi.mocked(fetch).mock.calls.filter(([input, options]) => (
      input === "/api/scheduler/jobs/catalog.import.all" && options?.method === "PATCH"
    ));
    const patchCall = patchCalls[patchCalls.length - 1];
    expect(patchCall).toBeDefined();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ interval_seconds: 172800 });
  });

  it("lets operators run the ordered maintenance sequence", async () => {
    storeSession("OPERATOR");
    mockFetch("OPERATOR");
    window.history.pushState({}, "", "/operator/sync");

    render(<App />);

    const button = await screen.findByRole("button", { name: /run all providers sequence/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/scheduler/jobs/run-maintenance",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ provider_code: null }),
        }),
      );
    });
    expect(await screen.findByText(/finished all providers sequence/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /all providers sequence progress/i })).toHaveAttribute("aria-valuenow", "100");

    await userEvent.selectOptions(screen.getByLabelText("Provider"), "greenPlug");
    await userEvent.click(screen.getByRole("button", { name: /run greenplug sequence/i }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/scheduler/jobs/run-maintenance",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ provider_code: "greenPlug" }),
        }),
      );
    });
    expect(await screen.findByText(/finished greenplug sequence/i)).toBeInTheDocument();
  });

  it("blocks EV users from operator scheduler controls", async () => {
    storeSession("EV_USER");
    mockFetch("EV_USER");
    window.history.pushState({}, "", "/operator/sync");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument());
  });

  it("redirects anonymous provider registration access to sign-in", async () => {
    window.history.pushState({}, "", "/provider-register");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /sign in to saasplug/i })).toBeInTheDocument();
  });

  it("blocks EV users from provider registration", async () => {
    storeSession("EV_USER");
    mockFetch("EV_USER");
    window.history.pushState({}, "", "/provider-register");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument());
  });

  it("blocks provider admins from provider registration", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/provider-register");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument());
  });

  it("allows operators to open provider registration", async () => {
    storeSession("OPERATOR");
    mockFetch("OPERATOR");
    window.history.pushState({}, "", "/provider-register");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /register a provider workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage providers/i })).toHaveAttribute("href", "/operator/providers");
  });

  it("blocks provider admins from operator scheduler controls", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/operator/sync");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument());
  });

  it("blocks provider admins from the operator system page", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/operator/system");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument());
  });

  it("renders scheduler health and run history on the operator system page", async () => {
    storeSession("OPERATOR");
    mockFetch("OPERATOR");
    window.history.pushState({}, "", "/operator/system");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /system overview/i })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("tab", { name: /scheduler posture/i }));
    expect(await screen.findByRole("heading", { name: /scheduler posture/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /run duration milliseconds bar chart/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /background activity/i }));
    expect(await screen.findByText(/scheduler runs/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/succeeded/i)).length).toBeGreaterThan(0);
  });
});
