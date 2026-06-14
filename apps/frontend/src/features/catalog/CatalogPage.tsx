import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../../components/AppShell";
import {
  ChargingPointCard,
  MapFilterPanel,
  MapFloatingControls,
  SelectedFiltersBar,
} from "../../components/domain/ev";
import { Alert, EmptyState, LoadingBlock } from "../../components/Feedback";
import { MetricCard, PageHeader } from "../../components/ui";
import { requestJson, messageFromUnknownError } from "../../lib/api";
import { PROVIDERS, STATUSES } from "../../lib/formatting";
import {
  ATHENS_DEFAULT_BOUNDS,
  CATALOG_POINTS_PAGE_LIMIT,
  CATALOG_RESULT_LIMIT_OPTIONS,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  buildCatalogPointsPath,
  catalogQueryRadiusKm,
  moveBounds,
  pointWithinCatalogRadius,
  zoomBounds,
  type CatalogResultLimit,
} from "../../lib/routing";
import type { Bounds, CatalogFilters, CatalogPointListResponse, ProviderFreshness } from "../../lib/types";
import { CatalogMap } from "./CatalogMap";

const DEFAULT_FILTERS: CatalogFilters = {
  q: "",
  providerCode: "",
  status: "",
  connector: "",
  includeStale: false,
};

export function CatalogPage() {
  const [bounds, setBounds] = useState<Bounds>(ATHENS_DEFAULT_BOUNDS);
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [resultLimit, setResultLimit] = useState<CatalogResultLimit>("all");
  const [catalog, setCatalog] = useState<CatalogPointListResponse | null>(null);
  const [freshness, setFreshness] = useState<ProviderFreshness[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const catalogRequest = useMemo(() => ({ bounds, filters, resultLimit }), [bounds, filters, resultLimit]);

  useEffect(() => {
    const abortController = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [points, freshnessRows] = await Promise.all([
          loadCatalogPoints(catalogRequest.bounds, catalogRequest.filters, catalogRequest.resultLimit, abortController.signal),
          requestJson<ProviderFreshness[]>("/api/catalog/freshness", { signal: abortController.signal }),
        ]);
        setCatalog(points);
        setFreshness(freshnessRows);
      } catch (caught) {
        if (!abortController.signal.aborted) {
          setError(messageFromUnknownError(caught));
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [catalogRequest]);

  const activeTotal = freshness.reduce((sum, row) => sum + row.active_count, 0);
  const staleTotal = freshness.reduce((sum, row) => sum + row.stale_count, 0);
  const selectedPoint = catalog?.items.find((point) => point.id === selectedPointId) ?? null;
  const queryRadiusKm = catalogQueryRadiusKm(bounds.zoom);

  useEffect(() => {
    if (!catalog?.items.length) {
      setSelectedPointId(null);
      return;
    }
    if (selectedPointId && !catalog.items.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(null);
    }
  }, [catalog, selectedPointId]);

  return (
    <AppShell>
      <main className="page map-page">
        <PageHeader
          title="Charging map"
          description="Explore provider charging points, filter the visible catalog, and open reservation-ready point details."
        />

        <section className="metric-strip" aria-label="Catalog freshness">
          <MetricCard label="Points in radius" value={catalog?.total ?? 0} />
          <MetricCard label="Active catalog points" value={activeTotal} tone="success" />
          <MetricCard label="Stale catalog points" value={staleTotal} tone="warning" />
          <MetricCard label="Without coordinates" value={catalog?.missing_coordinates_count ?? 0} tone="info" />
        </section>

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
              <strong>{catalog?.total ?? 0} results</strong>
              <span>
                {catalog ? `${catalog.items.length} shown` : "Loading"} · {queryRadiusKm.toFixed(1)} km radius
              </span>
            </div>
            {loading ? <LoadingBlock label="Loading catalog" /> : null}
            {error ? (
              <Alert tone="danger" title="Catalog unavailable">
                {error}
              </Alert>
            ) : null}
            {!loading && !error && catalog?.items.length === 0 ? (
              <EmptyState title="No charging points found">
                The catalog may be empty until provider sync/import runs with valid provider credentials.
              </EmptyState>
            ) : null}
            <div className="point-list">
              {catalog?.items.map((point) => (
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
              onNorth={() => setBounds((current) => moveBounds(current, "north"))}
              onSouth={() => setBounds((current) => moveBounds(current, "south"))}
              onWest={() => setBounds((current) => moveBounds(current, "west"))}
              onEast={() => setBounds((current) => moveBounds(current, "east"))}
              onZoomIn={() => setBounds((current) => zoomBounds(current, "in"))}
              onZoomOut={() => setBounds((current) => zoomBounds(current, "out"))}
              zoom={bounds.zoom}
              minZoom={MAP_MIN_ZOOM}
              maxZoom={MAP_MAX_ZOOM}
            />
            {catalog ? (
              <CatalogMap
                points={catalog.items}
                bounds={bounds}
                selectedPointId={selectedPoint?.id}
                onSelectPoint={setSelectedPointId}
                onClosePoint={() => setSelectedPointId(null)}
                onBoundsChange={setBounds}
              />
            ) : (
              <LoadingBlock label="Loading map" />
            )}
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
): Promise<CatalogPointListResponse> {
  const firstPage = await requestJson<CatalogPointListResponse>(
    buildCatalogPointsPath(bounds, filters, CATALOG_POINTS_PAGE_LIMIT, 0),
    { signal },
  );

  const pageLimit = firstPage.limit || CATALOG_POINTS_PAGE_LIMIT;
  const offsets: number[] = [];
  for (let offset = pageLimit; offset < firstPage.total; offset += pageLimit) {
    offsets.push(offset);
  }

  const pages = await Promise.all(
    offsets.map((offset) => requestJson<CatalogPointListResponse>(
      buildCatalogPointsPath(bounds, filters, pageLimit, offset),
      { signal },
    )),
  );
  const radiusItems = [firstPage, ...pages]
    .flatMap((page) => page.items)
    .filter((point) => pointWithinCatalogRadius(point, bounds));
  const visibleItems = resultLimit === "all" ? radiusItems : radiusItems.slice(0, resultLimit);

  return {
    ...firstPage,
    items: visibleItems,
    total: radiusItems.length,
    limit: resultLimit === "all" ? radiusItems.length : resultLimit,
    offset: 0,
    missing_coordinates_count: 0,
  };
}
