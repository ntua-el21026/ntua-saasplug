import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "../../components/AppShell";
import {
  ChargingPointCard,
  MapFilterPanel,
  MapFloatingControls,
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
  moveBounds,
  pointWithinCatalogSearchCircle,
  sameCatalogSearchCircle,
  zoomBounds,
  type CatalogResultLimit,
} from "../../lib/routing";
import type { Bounds, CatalogFilters, CatalogPointListResponse } from "../../lib/types";
import { CatalogMap } from "./CatalogMap";

const DEFAULT_FILTERS: CatalogFilters = {
  q: "",
  providerCode: "",
  status: "",
  connector: "",
  includeStale: false,
};

export function CatalogPage() {
  const { session } = useAuth();
  const [bounds, setBounds] = useState<Bounds>(ATHENS_DEFAULT_BOUNDS);
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [resultLimit, setResultLimit] = useState<CatalogResultLimit>("all");
  const [catalog, setCatalog] = useState<CatalogPointListResponse | null>(null);
  const [mapCircleReady, setMapCircleReady] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);

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

  const catalogSearchBounds = useMemo(
    () => (catalog?.search_circle ? boundsFromCatalogSearchCircle(catalog.search_circle, bounds.zoom) : null),
    [bounds, catalog?.search_circle],
  );
  const catalogMatchesCurrentCircle = catalog
    ? catalogSearchBounds !== null && sameCatalogSearchCircle(catalogSearchBounds, bounds)
    : true;
  const catalogItemsForCircle = useMemo(
    () => (catalogMatchesCurrentCircle ? catalog?.items ?? [] : []),
    [catalog, catalogMatchesCurrentCircle],
  );
  const displayedCatalog = catalogMatchesCurrentCircle ? catalog : null;
  const searchBounds = catalogMatchesCurrentCircle && catalogSearchBounds ? catalogSearchBounds : bounds;
  const currentItems = useMemo(
    () => catalogItemsForCircle.filter((point) => pointWithinCatalogSearchCircle(point, searchBounds)),
    [catalogItemsForCircle, searchBounds],
  );
  const selectedPoint = currentItems.find((point) => point.id === selectedPointId) ?? null;
  const queryRadiusKm = catalogQueryRadiusKm(searchBounds);

  const handleBoundsChange = useCallback((nextBounds: Bounds) => {
    setMapCircleReady(true);
    setBounds((current) => (sameCatalogSearchCircle(current, nextBounds) ? current : nextBounds));
  }, []);

  const updateBoundsFromControl = useCallback((updater: (current: Bounds) => Bounds) => {
    setBounds((current) => updater(current));
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
      <main className="page map-page">
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
            {error ? (
              <Alert tone="danger" title="Catalog unavailable">
                {error}
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
                  onSelect={() => setSelectedPointId(point.id)}
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
            <MapFloatingControls
              onNorth={() => updateBoundsFromControl((current) => moveBounds(current, "north"))}
              onSouth={() => updateBoundsFromControl((current) => moveBounds(current, "south"))}
              onWest={() => updateBoundsFromControl((current) => moveBounds(current, "west"))}
              onEast={() => updateBoundsFromControl((current) => moveBounds(current, "east"))}
              onZoomIn={() => updateBoundsFromControl((current) => zoomBounds(current, "in"))}
              onZoomOut={() => updateBoundsFromControl((current) => zoomBounds(current, "out"))}
              zoom={bounds.zoom}
              minZoom={MAP_MIN_ZOOM}
              maxZoom={MAP_MAX_ZOOM}
            />
            <CatalogMap
              points={currentItems}
              bounds={bounds}
              searchBounds={searchBounds}
              selectedPointId={selectedPoint?.id}
              onSelectPoint={setSelectedPointId}
              onClosePoint={() => setSelectedPointId(null)}
              onBoundsChange={handleBoundsChange}
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
  const firstPage = await requestJson<CatalogPointListResponse>(
    buildCatalogPointsPath(bounds, filters, fetchLimit, 0),
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
      buildCatalogPointsPath(bounds, filters, pageLimit, offset),
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
