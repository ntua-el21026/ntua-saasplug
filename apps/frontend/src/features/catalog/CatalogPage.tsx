import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "../../components/AppShell";
import {
  ChargingPointCard,
  MapFilterPanel,
  SelectedFiltersBar,
} from "../../components/domain/ev";
import { Alert, EmptyState, LoadingBlock } from "../../components/Feedback";
import { requestJson, messageFromUnknownError } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";
import { PROVIDERS, STATUSES } from "../../lib/formatting";
import {
  ATHENS_DEFAULT_BOUNDS,
  CATALOG_POINTS_PAGE_LIMIT,
  CATALOG_RESULT_LIMIT_OPTIONS,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  boundsFromCatalogSearchCircle,
  buildCatalogPointsPath,
  catalogSearchCircle,
  catalogQueryRadiusKm,
  pointWithinCatalogSearchCircle,
  sameCatalogSearchCircle,
  type CatalogResultLimit,
} from "../../lib/routing";
import { applyStatusLookup, fetchPointStatuses, statusLookupKeyForPoint } from "../../lib/statusLookups";
import type { Bounds, CatalogFilters, CatalogPoint, CatalogPointListResponse, StatusLookupResponse } from "../../lib/types";
import { CatalogMap } from "./CatalogMap";

const DEFAULT_FILTERS: CatalogFilters = {
  q: "",
  providerCode: "",
  status: "",
  connector: "",
  includeStale: false,
};
const MAP_VIEWPORT_STORAGE_KEY = "saasplug.catalog.viewport.v1";

export function CatalogPage() {
  const { session } = useAuth();
  const [bounds, setBounds] = useState<Bounds>(readStoredBounds);
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [resultLimit, setResultLimit] = useState<CatalogResultLimit>("all");
  const [catalog, setCatalog] = useState<CatalogPointListResponse | null>(null);
  const [mapCircleReady, setMapCircleReady] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusLookups, setStatusLookups] = useState<Record<string, StatusLookupResponse>>({});
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusRefreshNonce, setStatusRefreshNonce] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    window.sessionStorage.setItem(MAP_VIEWPORT_STORAGE_KEY, JSON.stringify(bounds));
  }, [bounds]);

  useEffect(() => {
    if (!fullscreen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullscreen]);

  const catalogRequest = useMemo(() => ({ bounds, filters, resultLimit }), [bounds, filters, resultLimit]);

  useEffect(() => {
    if (!mapCircleReady) {
      return;
    }

    const abortController = new AbortController();
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setCatalog(null);
    setLoading(true);
    setError(null);

    const timeout = window.setTimeout(async () => {
      try {
        const points = await loadCatalogPoints(
          catalogRequest.bounds,
          catalogRequest.filters,
          catalogRequest.resultLimit,
          abortController.signal,
          session?.accessToken,
        );
        if (!abortController.signal.aborted && latestRequestIdRef.current === requestId) {
          setCatalog(points);
        }
      } catch (caught) {
        if (!abortController.signal.aborted && latestRequestIdRef.current === requestId) {
          setError(messageFromUnknownError(caught));
        }
      } finally {
        if (!abortController.signal.aborted && latestRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [catalogRequest, mapCircleReady, session?.accessToken]);

  const catalogItems = useMemo(() => catalog?.items ?? [], [catalog]);

  useEffect(() => {
    if (!catalogItems.length || !session?.accessToken) {
      setStatusLookups({});
      setStatusLoading(false);
      setStatusError(null);
      return;
    }

    const abortController = new AbortController();
    setStatusLoading(true);
    setStatusError(null);
    fetchPointStatuses(catalogItems, session.accessToken, abortController.signal)
      .then((response) => {
        if (abortController.signal.aborted) {
          return;
        }
        setStatusLookups(Object.fromEntries(
          response.items.map((item) => [statusLookupKeyForPoint(item), item]),
        ));
        setStatusError(response.errors.length ? `${response.errors.length} status lookup${response.errors.length === 1 ? "" : "s"} could not be refreshed.` : null);
      })
      .catch((caught) => {
        if (!abortController.signal.aborted) {
          setStatusLookups({});
          setStatusError(messageFromUnknownError(caught));
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setStatusLoading(false);
        }
      });

    return () => abortController.abort();
  }, [catalogItems, session?.accessToken, statusRefreshNonce]);

  useEffect(() => {
    const expiresAt = Object.values(statusLookups)
      .map((lookup) => Date.parse(lookup.expires_at))
      .filter((value) => Number.isFinite(value));
    if (!expiresAt.length) {
      return undefined;
    }
    const delayMs = Math.max(1000, Math.min(...expiresAt) - Date.now() + 250);
    const timerId = window.setTimeout(() => {
      setStatusRefreshNonce((current) => current + 1);
    }, delayMs);
    return () => window.clearTimeout(timerId);
  }, [statusLookups]);

  const catalogItemsWithStatus = useMemo(
    () => catalogItems.map((point) => applyStatusLookup(point, statusLookups[statusLookupKeyForPoint(point)])),
    [catalogItems, statusLookups],
  );
  const statusFilteredItems = useMemo(
    () => (filters.status ? catalogItemsWithStatus.filter((point) => point.status === filters.status) : catalogItemsWithStatus),
    [catalogItemsWithStatus, filters.status],
  );
  const catalogSearchBounds = useMemo(
    () => (catalog?.search_circle ? boundsFromCatalogSearchCircle(catalog.search_circle, bounds.zoom) : null),
    [bounds, catalog?.search_circle],
  );
  const catalogMatchesCurrentCircle = catalog
    ? catalogSearchBounds !== null && sameCatalogSearchCircle(catalogSearchBounds, bounds)
    : true;
  const catalogItemsForCircle = useMemo(
    () => (catalogMatchesCurrentCircle ? statusFilteredItems : []),
    [catalogMatchesCurrentCircle, statusFilteredItems],
  );
  const displayedCatalog = catalogMatchesCurrentCircle ? catalog : null;
  const searchBounds = catalogMatchesCurrentCircle && catalogSearchBounds ? catalogSearchBounds : bounds;
  const currentItems = useMemo(
    () => catalogItemsForCircle.filter((point) => pointWithinCatalogSearchCircle(point, searchBounds)),
    [catalogItemsForCircle, searchBounds],
  );
  const selectedPoint = currentItems.find((point) => point.id === selectedPointId) ?? null;
  const queryRadiusKm = catalogQueryRadiusKm(searchBounds);

  const trackPointView = useCallback((point: CatalogPoint) => {
    void requestJson<CatalogPoint>(
      `/api/catalog/points/${encodeURIComponent(point.provider_code)}/${encodeURIComponent(point.external_point_id)}/views`,
      {
        method: "POST",
        accessToken: session?.accessToken,
        bodyJson: {
          view_source: "map_quick_view",
          status: point.status,
          reservation_ends_at: point.reservation_ends_at,
        },
      },
    ).catch(() => undefined);
  }, [session?.accessToken]);

  const handlePointSelect = useCallback((pointId: string) => {
    setSelectedPointId(pointId);
    const point = currentItems.find((item) => item.id === pointId);
    if (point) {
      trackPointView(point);
    }
  }, [currentItems, trackPointView]);

  const handleBoundsChange = useCallback((nextBounds: Bounds) => {
    setMapCircleReady(true);
    setBounds((current) => (sameCatalogSearchCircle(current, nextBounds) ? current : nextBounds));
  }, []);

  useEffect(() => {
    if (!currentItems.length) {
      setSelectedPointId(null);
      return;
    }
    if (selectedPointId && !currentItems.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(null);
    }
  }, [currentItems, selectedPointId]);

  return (
    <AppShell>
      <main className={`page map-page ${fullscreen ? "is-map-fullscreen" : ""}`}>
        <section className="map-workspace">
          <aside className="map-results-panel" aria-label="Charging point filters and results">
            <MapFilterPanel
              filters={filters}
              providers={PROVIDERS}
              statuses={STATUSES}
              resultLimit={resultLimit}
              resultLimitOptions={CATALOG_RESULT_LIMIT_OPTIONS}
              onChange={setFilters}
              onResultLimitChange={setResultLimit}
            />
            <SelectedFiltersBar filters={filters} onChange={setFilters} />
            <div className="results-summary">
              <strong>{displayedCatalog ? currentItems.length : 0} results</strong>
              <span>
                {displayedCatalog ? `${currentItems.length} shown` : "Loading"} · {queryRadiusKm.toFixed(1)} km radius
              </span>
            </div>
            {loading ? <LoadingBlock label="Loading catalog" /> : null}
            {statusLoading ? <LoadingBlock label="Checking point statuses" /> : null}
            {error ? (
              <Alert tone="danger" title="Catalog unavailable">
                {error}
              </Alert>
            ) : null}
            {statusError ? (
              <Alert tone="warning" title="Status lookup incomplete">
                {statusError}
              </Alert>
            ) : null}
            {!loading && !error && displayedCatalog && currentItems.length === 0 ? (
              <EmptyState title="No charging points found">
                The catalog may be empty until provider sync/import runs with valid provider credentials.
              </EmptyState>
            ) : null}
            <div className="point-list">
              {currentItems.map((point) => (
                <ChargingPointCard
                  key={point.id}
                  point={point}
                  selected={selectedPoint?.id === point.id}
                  onSelect={() => handlePointSelect(point.id)}
                />
              ))}
            </div>
          </aside>

          <section className="map-canvas-panel" aria-label="Map viewport">
            <div className="map-canvas-header">
              <div>
                <h2>Live viewport</h2>
                <p>
                  Center radius {queryRadiusKm.toFixed(1)} km · Zoom {bounds.zoom} out of {MAP_MAX_ZOOM}
                </p>
              </div>
            </div>
            <div className="map-fullscreen-control maplibregl-ctrl maplibregl-ctrl-group">
              <button
                aria-label={fullscreen ? "Exit fullscreen" : "Full screen"}
                aria-pressed={fullscreen}
                className={`map-fullscreen-toggle maplibregl-ctrl-${fullscreen ? "shrink" : "fullscreen"}`}
                onClick={() => setFullscreen((current) => !current)}
                title={fullscreen ? "Exit fullscreen" : "Full screen"}
                type="button"
              >
                <span aria-hidden="true" className="maplibregl-ctrl-icon" />
              </button>
            </div>
            <CatalogMap
              points={currentItems}
              bounds={bounds}
              searchBounds={searchBounds}
              selectedPointId={selectedPoint?.id}
              onSelectPoint={handlePointSelect}
              onClosePoint={() => setSelectedPointId(null)}
              onBoundsChange={handleBoundsChange}
              layoutMode={fullscreen ? "fullscreen" : "standard"}
              loading={loading}
            />
          </section>

        </section>
      </main>
    </AppShell>
  );
}

async function loadCatalogPoints(
  bounds: Bounds,
  filters: CatalogFilters,
  resultLimit: CatalogResultLimit,
  signal: AbortSignal,
  accessToken?: string | null,
): Promise<CatalogPointListResponse> {
  const fetchLimit = resultLimit === "all" ? CATALOG_POINTS_PAGE_LIMIT : Math.min(CATALOG_POINTS_PAGE_LIMIT, resultLimit);
  const requestCircle = catalogSearchCircle(bounds);
  const catalogFilters = { ...filters, status: "" as CatalogFilters["status"] };
  const firstPage = await requestJson<CatalogPointListResponse>(
    buildCatalogPointsPath(bounds, catalogFilters, fetchLimit, 0),
    { signal, accessToken },
  );

  const pageLimit = firstPage.limit || CATALOG_POINTS_PAGE_LIMIT;
  const offsets: number[] = [];
  if (resultLimit === "all") {
    for (let offset = pageLimit; offset < firstPage.total; offset += pageLimit) {
      offsets.push(offset);
    }
  }

  const pages = await Promise.all(
    offsets.map((offset) => requestJson<CatalogPointListResponse>(
      buildCatalogPointsPath(bounds, catalogFilters, pageLimit, offset),
      { signal, accessToken },
    )),
  );
  const items = [firstPage, ...pages].flatMap((page) => page.items);

  return {
    ...firstPage,
    items,
    total: firstPage.total,
    limit: firstPage.limit,
    offset: 0,
    search_circle: firstPage.search_circle ?? {
      center_lat: requestCircle.centerLat,
      center_lng: requestCircle.centerLng,
      radius_km: requestCircle.radiusKm,
    },
  };
}

function readStoredBounds(): Bounds {
  try {
    const value = window.sessionStorage.getItem(MAP_VIEWPORT_STORAGE_KEY);
    if (!value) {
      return ATHENS_DEFAULT_BOUNDS;
    }
    const parsed = JSON.parse(value) as Partial<Bounds>;
    if (
      typeof parsed.minLat !== "number" || typeof parsed.maxLat !== "number"
      || typeof parsed.minLng !== "number" || typeof parsed.maxLng !== "number"
      || typeof parsed.zoom !== "number" || typeof parsed.radiusKm !== "number"
      || !Number.isFinite(parsed.minLat) || !Number.isFinite(parsed.maxLat)
      || !Number.isFinite(parsed.minLng) || !Number.isFinite(parsed.maxLng)
      || !Number.isFinite(parsed.zoom) || !Number.isFinite(parsed.radiusKm)
      || parsed.minLat >= parsed.maxLat || parsed.minLng >= parsed.maxLng
      || parsed.zoom < MAP_MIN_ZOOM || parsed.zoom > MAP_MAX_ZOOM || parsed.radiusKm <= 0
    ) {
      return ATHENS_DEFAULT_BOUNDS;
    }
    return parsed as Bounds;
  } catch {
    return ATHENS_DEFAULT_BOUNDS;
  }
}
