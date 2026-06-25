import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import type { CatalogPoint, CatalogSearchCircleResponse, ProviderFreshness, User } from "../lib/types";

const STORAGE_KEY = "saasplug.ev.session";
const VIEWPORT_STORAGE_KEY = "saasplug.catalog.viewport.v1";
const ASYNC_WAIT = { timeout: 5_000 };

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
    window.sessionStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("opens a provider-colored marker popup before navigating to reservation details", async () => {
    const fetchMock = mockGateway();
    storeSession();
    window.history.pushState({}, "", "/map");

    render(<App />);

    expect(await screen.findByLabelText("Charging point filters and results", undefined, ASYNC_WAIT)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show filters" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Charger type")).not.toBeInTheDocument();
    expect(await screen.findByText("3 results", undefined, ASYNC_WAIT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Map viewport controls")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "N" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "W" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "E" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "S" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show Outside Hub 99 on map" })).not.toBeInTheDocument();
    expect(screen.queryByText("Outside Hub 99")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Current catalog radius", undefined, ASYNC_WAIT)).toHaveTextContent(/km radius/);
    const legendToggle = screen.getByRole("button", { name: "Show provider marker legend" });
    expect(legendToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Provider marker legend")).not.toBeInTheDocument();
    await userEvent.click(legendToggle);
    const providerLegend = screen.getByLabelText("Provider marker legend");
    expect(within(providerLegend).getByText("redPlug")).toBeInTheDocument();
    expect(within(providerLegend).getByText("greenPlug")).toBeInTheDocument();
    expect(within(providerLegend).getByText("bluePlug")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide provider marker legend" })).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(screen.getByRole("button", { name: "Hide provider marker legend" }));
    expect(screen.queryByLabelText("Provider marker legend")).not.toBeInTheDocument();
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

    await userEvent.click(await screen.findByRole("button", { name: "Show Red Hub 01 details" }, ASYNC_WAIT));

    const popup = await screen.findByLabelText("Red Hub 01 quick details", undefined, ASYNC_WAIT);
    expect(within(popup).getByRole("heading", { name: "Red Hub 01" })).toBeInTheDocument();
    expect(within(popup).getByText("Point ID")).toBeInTheDocument();
    expect(within(popup).getAllByText("redPlug").length).toBeGreaterThan(0);
    expect(within(popup).getByRole("link", { name: "Reserve charger" })).toHaveAttribute("href", "/points/redPlug/r-1");
    const pointViewCalls = catalogPointViewCalls(fetchMock);
    expect(pointViewCalls).toHaveLength(1);
    expect(pointViewCalls[0].url.pathname).toBe("/api/catalog/points/redPlug/r-1/views");
    expect(pointViewCalls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(pointViewCalls[0].init?.body))).toEqual({
      view_source: "map_quick_view",
      status: "available",
      reservation_ends_at: null,
    });

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

    expect(await screen.findByText("3 results", undefined, ASYNC_WAIT)).toBeInTheDocument();
    const initialPointCall = latestCatalogPointCall(fetchMock);
    expect(initialPointCall).toBeDefined();
    const initialRadiusKm = Number(initialPointCall?.searchParams.get("radiusKm"));

    const initialCatalogCallCount = catalogPointCalls(fetchMock).length;
    const mapElement = document.querySelector(".maplibre-map");
    expect(mapElement).not.toBeNull();
    fireEvent(
      mapElement as Element,
      new CustomEvent("saasplug:test-pan", { detail: { latDelta: 0, lngDelta: 0 } }),
    );
    await expectNoAdditionalCatalogCalls(fetchMock, initialCatalogCallCount);

    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));

    expect(await screen.findByText("4 results", undefined, ASYNC_WAIT)).toBeInTheDocument();
    const zoomedPointCall = latestCatalogPointCall(fetchMock);
    expect(zoomedPointCall).toBeDefined();
    if (!zoomedPointCall) {
      throw new Error("Missing zoomed catalog points request");
    }
    const zoomedRadiusKm = Number(zoomedPointCall.searchParams.get("radiusKm"));
    expect(zoomedRadiusKm).toBeGreaterThan(initialRadiusKm);
    expect(await screen.findByLabelText("Current catalog radius", undefined, ASYNC_WAIT)).toHaveTextContent(`${zoomedRadiusKm.toFixed(1)} km radius`);
    await waitFor(() => {
      expect(radiusKmFromSource(searchCircleFromUrl(zoomedPointCall))).toBeCloseTo(zoomedRadiusKm, 2);
    });
    expect(screen.getByText("Zoom Out Hub")).toBeInTheDocument();
    expect(document.querySelector('[data-point-id="green-zoom-out"]')).toBeInTheDocument();
    expect(screen.queryByText("Very Far Hub")).not.toBeInTheDocument();
    expect(document.querySelector('[data-point-id="red-far-outside"]')).not.toBeInTheDocument();
  }, 10_000);

  it("caps dense map viewports to 75 sampled sidebar rows and markers", async () => {
    const densePoints = makeDensePoints(120);
    mockGateway(densePoints);
    storeSession();
    window.history.pushState({}, "", "/map");

    render(<App />);

    expect(await screen.findByText("75 results", undefined, ASYNC_WAIT)).toBeInTheDocument();
    expect(screen.getByText(/75 of 120 shown/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelectorAll(".charging-point-card")).toHaveLength(75);
      expect(document.querySelectorAll(".maplibre-point-marker")).toHaveLength(75);
    });

    const renderedIndexes = Array.from(document.querySelectorAll(".charging-point-card strong"))
      .map((node) => Number(node.textContent?.match(/Dense Hub (\d+)/)?.[1] ?? -1))
      .filter((index) => index >= 0);
    expect(renderedIndexes).toHaveLength(75);
    expect(renderedIndexes.some((index) => index >= 75)).toBe(true);
  }, 10_000);

  it("preserves the adjusted map viewport when leaving and reopening the map route", async () => {
    const fetchMock = mockGateway();
    storeSession();
    window.history.pushState({}, "", "/map");

    render(<App />);

    expect(await screen.findByText("3 results", undefined, ASYNC_WAIT)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    const zoomedViewport = await waitFor(() => {
      const stored = readStoredViewport();
      expect(stored?.zoom).toBe(14);
      return stored;
    });

    const mapElement = document.querySelector(".maplibre-map");
    expect(mapElement).not.toBeNull();
    fireEvent(
      mapElement as Element,
      new CustomEvent("saasplug:test-pan", { detail: { latDelta: 0.003, lngDelta: -0.004 } }),
    );
    fireEvent(
      mapElement as Element,
      new CustomEvent("saasplug:test-camera", { detail: { zoom: 13.35 } }),
    );
    const pannedViewport = await waitFor(() => {
      const stored = readStoredViewport();
      expect(stored?.zoom).toBeCloseTo(13.35, 5);
      expect(stored?.centerLat).toBeCloseTo((zoomedViewport?.centerLat ?? 0) + 0.003, 5);
      expect(stored?.centerLng).toBeCloseTo((zoomedViewport?.centerLng ?? 0) - 0.004, 5);
      expect(stored?.radiusKm).toBeGreaterThan(0);
      return stored;
    });

    expect(pannedViewport).not.toBeNull();
    const latestPannedCall = await waitFor(() => {
      const call = latestCatalogPointCall(fetchMock);
      expect(call).toBeDefined();
      expect(Number(call?.searchParams.get("centerLat"))).toBeCloseTo(pannedViewport?.centerLat ?? 0, 5);
      expect(Number(call?.searchParams.get("centerLng"))).toBeCloseTo(pannedViewport?.centerLng ?? 0, 5);
      expect(Number(call?.searchParams.get("radiusKm"))).toBeCloseTo(pannedViewport?.radiusKm ?? 0, 5);
      return call;
    });
    expect(latestPannedCall).toBeDefined();
    const visibleMarkerIdsBeforeNavigation = await waitFor(() => {
      const ids = visibleMarkerIds();
      expect(ids.length).toBeGreaterThan(0);
      return ids;
    });
    const catalogCallsBeforeNavigation = catalogPointCalls(fetchMock).length;

    await userEvent.click(screen.getAllByRole("link", { name: "Reservations" })[0]);
    expect(await screen.findByRole("heading", { name: /^reservations$/i }, ASYNC_WAIT)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("link", { name: "Map" })[0]);

    expect(await screen.findByText(`${visibleMarkerIdsBeforeNavigation.length} results`, undefined, ASYNC_WAIT)).toBeInTheDocument();
    await waitFor(() => {
      const stored = readStoredViewport();
      expect(stored?.zoom).toBeCloseTo(13.35, 5);
      expect(stored?.centerLat).toBeCloseTo(pannedViewport?.centerLat ?? 0, 5);
      expect(stored?.centerLng).toBeCloseTo(pannedViewport?.centerLng ?? 0, 5);
      expect(stored?.radiusKm).toBeCloseTo(pannedViewport?.radiusKm ?? 0, 5);
    });
    const restoredCall = latestCatalogPointCall(fetchMock);
    expect(restoredCall).toBeDefined();
    expect(Number(restoredCall?.searchParams.get("centerLat"))).toBeCloseTo(pannedViewport?.centerLat ?? 0, 5);
    expect(Number(restoredCall?.searchParams.get("centerLng"))).toBeCloseTo(pannedViewport?.centerLng ?? 0, 5);
    expect(Number(restoredCall?.searchParams.get("radiusKm"))).toBeCloseTo(pannedViewport?.radiusKm ?? 0, 5);
    await waitFor(() => {
      expect(visibleMarkerIds()).toEqual(visibleMarkerIdsBeforeNavigation);
    });
    await expectNoAdditionalCatalogCalls(fetchMock, catalogCallsBeforeNavigation);
  }, 10_000);

  it("opens and exits fullscreen map mode with the result list preserved", async () => {
    mockGateway();
    storeSession();
    window.history.pushState({}, "", "/map");

    render(<App />);

    expect(await screen.findByText("3 results", undefined, ASYNC_WAIT)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /full screen/i }));

    expect(screen.getByRole("button", { name: /exit fullscreen/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Charging point filters and results")).toBeInTheDocument();
    expect(screen.getByLabelText("Map viewport")).toBeInTheDocument();
    expect(screen.getByText("Red Hub 01")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByRole("button", { name: /full screen/i })).toHaveAttribute("aria-pressed", "false");
  }, 10_000);

  it("ignores stale catalog responses after the search circle changes", async () => {
    const staleResponse = deferred<Response>();
    const shiftedPoint = point("green-shifted", "greenPlug", "Shifted Hub", "g-shifted", 37.985, 23.79);
    const catalogCalls: URL[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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

      if (url.pathname === "/api/status/cache/statuses") {
        return json(statusBatchResponse(init));
      }

      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    storeSession();
    window.history.pushState({}, "", "/map");

    render(<App />);

    await waitFor(() => expect(catalogCalls).toHaveLength(1), { timeout: 3_000 });
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    await waitFor(() => expect(catalogCalls).toHaveLength(2), { timeout: 3_000 });

    expect(await screen.findByText("Shifted Hub", undefined, ASYNC_WAIT)).toBeInTheDocument();
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
  const pointCalls = catalogPointCalls(fetchMock)
    .map(({ url }) => url);
  return pointCalls[pointCalls.length - 1];
}

function catalogPointCalls(fetchMock: ReturnType<typeof mockGateway>) {
  return fetchMock.mock.calls
    .map(([input]) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return { url: new URL(raw, "http://app.test") };
    })
    .filter(({ url }) => url.pathname === "/api/catalog/points");
}

async function expectNoAdditionalCatalogCalls(fetchMock: ReturnType<typeof mockGateway>, count: number) {
  await new Promise((resolve) => window.setTimeout(resolve, 450));
  expect(catalogPointCalls(fetchMock)).toHaveLength(count);
}

function catalogPointViewCalls(fetchMock: ReturnType<typeof mockGateway>) {
  return fetchMock.mock.calls
    .map(([input, init]) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return { url: new URL(raw, "http://app.test"), init };
    })
    .filter(({ url }) => url.pathname.endsWith("/views"));
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

function readStoredViewport(): { centerLat?: number; centerLng?: number; radiusKm?: number; zoom?: number } | null {
  const stored = window.sessionStorage.getItem(VIEWPORT_STORAGE_KEY);
  if (!stored) {
    return null;
  }
  const parsed = JSON.parse(stored) as {
    centerLat?: number;
    centerLng?: number;
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
    radiusKm?: number;
    zoom?: number;
  };
  return {
    centerLat: typeof parsed.centerLat === "number"
      ? parsed.centerLat
      : typeof parsed.minLat === "number" && typeof parsed.maxLat === "number"
        ? (parsed.minLat + parsed.maxLat) / 2
        : undefined,
    centerLng: typeof parsed.centerLng === "number"
      ? parsed.centerLng
      : typeof parsed.minLng === "number" && typeof parsed.maxLng === "number"
      ? (parsed.minLng + parsed.maxLng) / 2
      : undefined,
    radiusKm: parsed.radiusKm,
    zoom: parsed.zoom,
  };
}

function visibleMarkerIds(): string[] {
  return Array.from(document.querySelectorAll(".maplibre-point-marker"))
    .map((node) => (node as HTMLElement).dataset.pointId)
    .filter((pointId): pointId is string => Boolean(pointId));
}

function mockGateway(catalogPoints: CatalogPoint[] = points) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
        items: catalogPoints.slice(offset, offset + limit),
        total: catalogPoints.length,
        limit,
        offset,
        bounds_applied: true,
        missing_coordinates_count: 0,
        search_circle: searchCircleFromUrl(url),
      });
    }

    if (url.pathname === "/api/status/cache/statuses") {
      return json(statusBatchResponse(init, catalogPoints));
    }

    if (url.pathname === "/api/reservations/reservations/me") {
      return json([]);
    }

    if (url.pathname === "/api/analytics/ev/reservations/summary") {
      return json({
        user_id: user.id,
        total_reservations: 0,
        successful_reservations: 0,
        failed_reservations: 0,
        total_duration_minutes: 0,
        distinct_points: 0,
        estimated_reservations: 0,
        missing_estimate_count: 0,
        total_estimated_energy_kwh: null,
        total_estimated_cost_eur: null,
        average_estimated_cost_per_point_eur: null,
        average_estimated_cost_per_reservation_eur: null,
        currency: "EUR",
        estimate_basis: "none",
        last_event_ingested_at: null,
        last_aggregate_computed_at: null,
        analytics_delay_notice: "aggregates_current",
      });
    }

    const statusLookupMatch = url.pathname.match(/^\/api\/status\/points\/([^/]+)\/([^/]+)\/status$/);
    if (statusLookupMatch) {
      const [, providerCode, externalPointId] = statusLookupMatch;
      const requestedPoint = catalogPoints.find((item) => (
        item.provider_code === decodeURIComponent(providerCode)
        && item.external_point_id === decodeURIComponent(externalPointId)
      ));
      return json(statusLookupResponse(
        decodeURIComponent(providerCode) as CatalogPoint["provider_code"],
        decodeURIComponent(externalPointId),
        requestedPoint,
        "provider_live",
      ));
    }

    const pointViewMatch = url.pathname.match(/^\/api\/catalog\/points\/([^/]+)\/([^/]+)\/views$/);
    if (pointViewMatch) {
      const [, providerCode, externalPointId] = pointViewMatch;
      const viewedPoint = catalogPoints.find((item) => (
        item.provider_code === decodeURIComponent(providerCode)
        && item.external_point_id === decodeURIComponent(externalPointId)
      ));
      return viewedPoint ? json(viewedPoint) : json({ detail: "Catalog point not found" }, 404);
    }

    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function statusBatchResponse(init?: RequestInit, catalogPoints: CatalogPoint[] = points) {
  const body = typeof init?.body === "string"
    ? JSON.parse(init.body) as { points?: Array<{ provider_code: CatalogPoint["provider_code"]; external_point_id: string }> }
    : {};
  const requestedPoints = body.points ?? [];
  return {
    items: requestedPoints.map((requestedPoint) => {
      const catalogPoint = catalogPoints.find((item) => (
        item.provider_code === requestedPoint.provider_code
        && item.external_point_id === requestedPoint.external_point_id
      ));
      return statusLookupResponse(requestedPoint.provider_code, requestedPoint.external_point_id, catalogPoint, "cache");
    }),
    errors: [],
  };
}

function makeDensePoints(count: number): CatalogPoint[] {
  const providers: CatalogPoint["provider_code"][] = ["redPlug", "greenPlug", "bluePlug"];
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 12);
    const column = index % 12;
    return point(
      `dense-${index}`,
      providers[index % providers.length],
      `Dense Hub ${String(index).padStart(3, "0")}`,
      `dense-${index}`,
      37.985 + (row - 5) * 0.00025,
      23.78 + (column - 6) * 0.00025,
    );
  });
}

function statusLookupResponse(
  providerCode: CatalogPoint["provider_code"],
  externalPointId: string,
  catalogPoint: CatalogPoint | undefined,
  source: "cache" | "provider_live",
) {
  return {
    provider_code: providerCode,
    external_point_id: externalPointId,
    normalized_point_id: `${providerCode}:${externalPointId}`,
    status: catalogPoint?.status ?? "unknown",
    reservation_ends_at: catalogPoint?.reservation_ends_at ?? null,
    checked_at: "2026-06-13T00:00:00Z",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    cache_hit: source === "cache",
    provider_called: source === "provider_live",
    returned_stale: false,
    source,
    warning: null,
  };
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

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
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
