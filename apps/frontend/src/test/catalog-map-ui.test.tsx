import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import type { CatalogPoint, CatalogSearchCircleResponse, ProviderFreshness, User } from "../lib/types";

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
  point("blue-outside", "bluePlug", "Outside Hub 99", "b-99", 38.005, 23.78),
  point("green-zoom-out", "greenPlug", "Zoom Out Hub", "g-zoom", 37.996, 23.78),
  point("red-far-outside", "redPlug", "Very Far Hub", "r-far", 38.05, 23.78),
];

describe("catalog map UI", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("opens a provider-colored marker popup before navigating to reservation details", async () => {
    const fetchMock = mockGateway();
    storeSession();
    window.history.pushState({}, "", "/map");

    render(<App />);

    expect(await screen.findByLabelText("Charging point filters and results")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show filters" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Charger type")).not.toBeInTheDocument();
    expect(await screen.findByText("Zoom 15 out of 17")).toBeInTheDocument();
    expect(await screen.findByText("3 results")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show Outside Hub 99 on map" })).not.toBeInTheDocument();
    expect(screen.queryByText("Outside Hub 99")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Current catalog radius")).toHaveTextContent(/km radius/);
    const pointCall = fetchMock.mock.calls.find(([input]) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new URL(raw, "http://app.test").pathname === "/api/catalog/points";
    });
    expect(pointCall).toBeDefined();
    const pointUrl = new URL(String(pointCall?.[0]), "http://app.test");
    expect(pointUrl.searchParams.get("centerLat")).toBeTruthy();
    expect(pointUrl.searchParams.get("centerLng")).toBeTruthy();
    expect(Number(pointUrl.searchParams.get("radiusKm"))).toBeGreaterThan(0.05);
    expect(Number(pointUrl.searchParams.get("radiusKm"))).toBeLessThan(1.6);
    expect(pointUrl.searchParams.has("minLat")).toBe(false);
    expect(pointUrl.searchParams.has("maxLat")).toBe(false);
    expect(pointUrl.searchParams.has("minLng")).toBe(false);
    expect(pointUrl.searchParams.has("maxLng")).toBe(false);
    expect(pointUrl.searchParams.has("zoom")).toBe(false);
    expect(pointUrl.searchParams.get("limit")).toBe("500");
    await waitFor(() => {
      expect(radiusKmFromSource(searchCircleFromUrl(pointUrl))).toBeCloseTo(Number(pointUrl.searchParams.get("radiusKm")), 2);
    });
    await waitFor(() => expect(document.querySelector('[data-point-id="red-1"]')).toBeInTheDocument());
    expect(document.querySelector('[data-point-id="red-1"]')?.getAttribute("style")).toContain("--map-marker-color: #ef4444");
    expect(document.querySelector('[data-point-id="green-1"]')?.getAttribute("style")).toContain("--map-marker-color: #10b981");
    expect(document.querySelector('[data-point-id="blue-1"]')?.getAttribute("style")).toContain("--map-marker-color: #2563eb");
    expect(document.querySelector('[data-point-id="blue-outside"]')).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Map" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Reservations" })).toHaveLength(1);

    await userEvent.click(await screen.findByRole("button", { name: "Show Red Hub 01 on map" }));

    const popup = await screen.findByLabelText("Red Hub 01 quick details");
    expect(within(popup).getByRole("heading", { name: "Red Hub 01" })).toBeInTheDocument();
    expect(within(popup).getByText("Point ID")).toBeInTheDocument();
    expect(within(popup).getAllByText("redPlug").length).toBeGreaterThan(0);
    expect(within(popup).getByRole("link", { name: "Reserve charger" })).toHaveAttribute("href", "/points/redPlug/r-1");

    await userEvent.click(screen.getByRole("button", { name: "Show filters" }));
    const chargerTypeSelect = screen.getByLabelText("Charger type");
    await userEvent.selectOptions(chargerTypeSelect, "7");
    expect(chargerTypeSelect).toHaveValue("7");
    const resultLimitSelect = screen.getByLabelText("Results to show");
    await userEvent.selectOptions(resultLimitSelect, "40");

    expect(resultLimitSelect).toHaveValue("40");
  }, 10_000);

  it("recomputes the API circle from MapLibre after zooming out", async () => {
    const fetchMock = mockGateway();
    storeSession();
    window.history.pushState({}, "", "/map");

    render(<App />);

    expect(await screen.findByText("3 results")).toBeInTheDocument();
    const initialPointCall = latestCatalogPointCall(fetchMock);
    expect(initialPointCall).toBeDefined();
    const initialRadiusKm = Number(initialPointCall?.searchParams.get("radiusKm"));

    await userEvent.click(screen.getByRole("button", { name: "-" }));

    expect(await screen.findByText("4 results")).toBeInTheDocument();
    const zoomedPointCall = latestCatalogPointCall(fetchMock);
    expect(zoomedPointCall).toBeDefined();
    if (!zoomedPointCall) {
      throw new Error("Missing zoomed catalog points request");
    }
    const zoomedRadiusKm = Number(zoomedPointCall.searchParams.get("radiusKm"));
    expect(zoomedRadiusKm).toBeGreaterThan(initialRadiusKm);
    expect(await screen.findByLabelText("Current catalog radius")).toHaveTextContent(`${zoomedRadiusKm.toFixed(1)} km radius`);
    await waitFor(() => {
      expect(radiusKmFromSource(searchCircleFromUrl(zoomedPointCall))).toBeCloseTo(zoomedRadiusKm, 2);
    });
    expect(screen.getByText("Zoom Out Hub")).toBeInTheDocument();
    expect(document.querySelector('[data-point-id="green-zoom-out"]')).toBeInTheDocument();
    expect(screen.queryByText("Very Far Hub")).not.toBeInTheDocument();
    expect(document.querySelector('[data-point-id="red-far-outside"]')).not.toBeInTheDocument();
  }, 10_000);

  it("ignores stale catalog responses after the search circle changes", async () => {
    const staleResponse = deferred<Response>();
    const shiftedPoint = point("green-shifted", "greenPlug", "Shifted Hub", "g-shifted", 37.985, 23.79);
    const catalogCalls: URL[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(raw, "http://app.test");

      if (url.pathname === "/api/auth/auth/me") {
        return json(user);
      }

      if (url.pathname === "/api/catalog/freshness") {
        return json<ProviderFreshness[]>([]);
      }

      if (url.pathname === "/api/catalog/points") {
        catalogCalls.push(url);
        if (catalogCalls.length === 1) {
          return staleResponse.promise;
        }
        return json({
          items: [shiftedPoint],
          total: 1,
          limit: Number(url.searchParams.get("limit") ?? "500"),
          offset: Number(url.searchParams.get("offset") ?? "0"),
          bounds_applied: true,
          missing_coordinates_count: 0,
          search_circle: searchCircleFromUrl(url),
        });
      }

      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    storeSession();
    window.history.pushState({}, "", "/map");

    render(<App />);

    await waitFor(() => expect(catalogCalls).toHaveLength(1), { timeout: 3_000 });
    await userEvent.click(screen.getByRole("button", { name: "E" }));
    await waitFor(() => expect(catalogCalls).toHaveLength(2), { timeout: 3_000 });

    expect(await screen.findByText("Shifted Hub")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[data-point-id="green-shifted"]')).toBeInTheDocument());

    staleResponse.resolve(json({
      items: [points[0]],
      total: 1,
      limit: 500,
      offset: 0,
      bounds_applied: true,
      missing_coordinates_count: 0,
      search_circle: searchCircleFromUrl(catalogCalls[0]),
    }));

    await waitFor(() => {
      expect(screen.getByText("Shifted Hub")).toBeInTheDocument();
      expect(screen.queryByText("Red Hub 01")).not.toBeInTheDocument();
      expect(document.querySelector('[data-point-id="green-shifted"]')).toBeInTheDocument();
      expect(document.querySelector('[data-point-id="red-1"]')).not.toBeInTheDocument();
    });
  }, 10_000);
});

function latestCatalogPointCall(fetchMock: ReturnType<typeof mockGateway>): URL | undefined {
  const pointCalls = fetchMock.mock.calls
    .map(([input]) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new URL(raw, "http://app.test");
    })
    .filter((url) => url.pathname === "/api/catalog/points");
  return pointCalls[pointCalls.length - 1];
}

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
      // Deliberately return every point to prove the UI fails closed to the
      // echoed search circle instead of rendering broad API responses.
      return json({
        items: points.slice(offset, offset + limit),
        total: points.length,
        limit,
        offset,
        bounds_applied: true,
        missing_coordinates_count: 0,
        search_circle: searchCircleFromUrl(url),
      });
    }

    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function searchCircleFromUrl(url: URL): CatalogSearchCircleResponse {
  return {
    center_lat: Number(url.searchParams.get("centerLat")),
    center_lng: Number(url.searchParams.get("centerLng")),
    radius_km: Number(url.searchParams.get("radiusKm")),
  };
}

function radiusKmFromSource(circle: CatalogSearchCircleResponse): number {
  const source = document.querySelector(".maplibre-map")?.getAttribute("data-source-catalog-radius");
  if (!source) {
    throw new Error("Missing catalog radius source");
  }
  const geoJson = JSON.parse(source) as {
    features: Array<{ geometry: { coordinates: Array<Array<[number, number]>> } }>;
  };
  const [lng, lat] = geoJson.features[0].geometry.coordinates[0][0];
  return distanceKm({ lat: circle.center_lat, lng: circle.center_lng }, { lat, lng });
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
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
