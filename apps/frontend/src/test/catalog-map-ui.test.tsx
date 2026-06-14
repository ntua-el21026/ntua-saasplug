import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import type { CatalogPoint, ProviderFreshness, User } from "../lib/types";

const STORAGE_KEY = "saasplug.ev.session";

const user: User = {
  id: "ev-user-id",
  email: "evuser@saasplug.local",
  roles: ["EV_USER"],
  provider_id: null,
  provider_code: null,
};

const points: CatalogPoint[] = [
  point("red-1", "redPlug", "Red Hub 01", "r-1", 37.985, 23.78),
  point("green-1", "greenPlug", "Green Hub 02", "g-2", 37.99, 23.785),
  point("blue-1", "bluePlug", "Blue Hub 03", "b-3", 37.98, 23.775),
];

describe("catalog map UI", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("opens a provider-colored marker popup before navigating to reservation details", async () => {
    mockGateway();
    storeSession();
    window.history.pushState({}, "", "/map");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Charging map" })).toBeInTheDocument();
    expect(await screen.findByText("Zoom 15 out of 17")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Map" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Reservations" })).toHaveLength(1);

    await userEvent.click(await screen.findByRole("button", { name: "Show Red Hub 01 on map" }));

    const popup = await screen.findByLabelText("Red Hub 01 quick details");
    expect(within(popup).getByRole("heading", { name: "Red Hub 01" })).toBeInTheDocument();
    expect(within(popup).getByText("Point ID")).toBeInTheDocument();
    expect(within(popup).getAllByText("redPlug").length).toBeGreaterThan(0);
    expect(within(popup).getByRole("link", { name: "Reserve charger" })).toHaveAttribute("href", "/points/redPlug/r-1");

    await userEvent.click(screen.getByText("More filters"));
    const resultLimitSelect = screen.getByLabelText("Results to show");
    await userEvent.selectOptions(resultLimitSelect, "40");

    expect(resultLimitSelect).toHaveValue("40");
  });
});

function storeSession() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      expiresAt: Date.now() + 60_000,
      user,
    }),
  );
}

function mockGateway() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw, "http://app.test");

    if (url.pathname === "/api/auth/auth/me") {
      return json(user);
    }

    if (url.pathname === "/api/catalog/freshness") {
      return json<ProviderFreshness[]>([
        { provider_code: "redPlug", active_count: 1, stale_count: 0, last_successful_import_at: null, last_import_status: "succeeded" },
        { provider_code: "greenPlug", active_count: 1, stale_count: 0, last_successful_import_at: null, last_import_status: "succeeded" },
        { provider_code: "bluePlug", active_count: 1, stale_count: 0, last_successful_import_at: null, last_import_status: "succeeded" },
      ]);
    }

    if (url.pathname === "/api/catalog/points") {
      const limit = Number(url.searchParams.get("limit") ?? "500");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      return json({
        items: points.slice(offset, offset + limit),
        total: points.length,
        limit,
        offset,
        bounds_applied: true,
        missing_coordinates_count: 0,
      });
    }

    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json<T>(body: T): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function point(
  id: string,
  providerCode: CatalogPoint["provider_code"],
  displayName: string,
  externalPointId: string,
  latitude: number,
  longitude: number,
): CatalogPoint {
  return {
    id,
    normalized_point_id: `${providerCode}:${externalPointId}`,
    provider_code: providerCode,
    external_point_id: externalPointId,
    display_name: displayName,
    location_name: displayName,
    address: "Example Avenue 1",
    latitude,
    longitude,
    coordinate_source: "provider",
    status: "available",
    reservation_ends_at: null,
    price_per_kwh_eur: 0.42,
    capacity: 50,
    connector: "CCS",
    is_active: true,
    is_stale: false,
    last_provider_seen_at: "2026-06-14T20:58:00Z",
    last_catalog_sync_at: "2026-06-14T20:58:00Z",
  };
}
