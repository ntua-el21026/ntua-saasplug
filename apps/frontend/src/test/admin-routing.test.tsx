import { render, screen, waitFor } from "@testing-library/react";
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
      const body = responseFor(url.pathname, role);
      return new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }),
  );
}

function responseFor(pathname: string, role: Role): unknown {
  if (pathname === "/api/auth/auth/me") {
    return userFor(role);
  }
  if (pathname === "/api/analytics/provider/summary") {
    return providerSummary();
  }
  if (pathname === "/api/analytics/provider/trends/daily") {
    return [];
  }
  if (pathname === "/api/billing/providers/redPlug/overview" || pathname === "/api/billing/overview") {
    return billingOverview();
  }
  if (pathname === "/api/billing/invoices") {
    return [];
  }
  if (pathname === "/api/catalog/points") {
    return { items: [], total: 0, limit: 25, offset: 0, bounds_applied: false, missing_coordinates_count: 0 };
  }
  if (pathname === "/api/catalog/freshness") {
    return [];
  }
  if (pathname === "/api/analytics/operator/summary") {
    return operatorSummary();
  }
  if (pathname === "/api/providers/providers") {
    return [];
  }
  if (pathname === "/api/catalog/imports/runs") {
    return [];
  }
  return {};
}

function providerSummary() {
  return {
    provider_code: "redPlug",
    total_searches: 0,
    total_point_views: 0,
    total_status_checks: 0,
    successful_reservations: 0,
    failed_reservations: 0,
    reservation_conversion_rate: null,
    observed_amount: 0,
    currency: "EUR",
    top_viewed_points: [],
    top_reserved_points: [],
    status_distribution: {},
    data_freshness: null,
    last_event_ingested_at: null,
    last_aggregate_computed_at: null,
  };
}

function billingOverview() {
  return {
    provider_code: null,
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
    effective_pricing: null,
    provider_rows: [],
  };
}

function operatorSummary() {
  return {
    total_providers_seen: 0,
    active_providers_seen: 0,
    total_searches: 0,
    total_point_views: 0,
    total_status_checks: 0,
    successful_reservations: 0,
    failed_reservations: 0,
    global_conversion_rate: null,
    provider_comparison: [],
    daily_trends: [],
    catalog_health: [],
    last_event_ingested_at: null,
    last_aggregate_computed_at: null,
    analytics_delay_notice: null,
  };
}

describe("admin role routing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("redirects provider admins to the provider dashboard", async () => {
    storeSession("PROVIDER_ADMIN");
    mockFetch("PROVIDER_ADMIN");
    window.history.pushState({}, "", "/");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /provider command center/i })).toBeInTheDocument();
  });

  it("redirects operators to the operator dashboard", async () => {
    storeSession("OPERATOR");
    mockFetch("OPERATOR");
    window.history.pushState({}, "", "/");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /operator command center/i })).toBeInTheDocument();
  });

  it("blocks EV users from provider-admin routes", async () => {
    storeSession("EV_USER");
    mockFetch("EV_USER");
    window.history.pushState({}, "", "/provider/dashboard");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument());
  });
});
