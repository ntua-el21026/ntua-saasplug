import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../../components/AppShell";
import {
  ChargingPointCard,
  ChargingPointDrawer,
  MapFilterPanel,
  MapFloatingControls,
  SelectedFiltersBar,
} from "../../components/domain/ev";
import { Alert, EmptyState, LoadingBlock } from "../../components/Feedback";
import { MetricCard, PageHeader } from "../../components/ui";
import { requestJson, messageFromUnknownError } from "../../lib/api";
import { PROVIDERS, STATUSES } from "../../lib/formatting";
import { ATHENS_DEFAULT_BOUNDS, buildCatalogPointsPath, moveBounds, zoomBounds } from "../../lib/routing";
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
  const [catalog, setCatalog] = useState<CatalogPointListResponse | null>(null);
  const [freshness, setFreshness] = useState<ProviderFreshness[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const catalogPath = useMemo(() => buildCatalogPointsPath(bounds, filters), [bounds, filters]);

  useEffect(() => {
    const abortController = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [points, freshnessRows] = await Promise.all([
          requestJson<CatalogPointListResponse>(catalogPath, { signal: abortController.signal }),
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
  }, [catalogPath]);

  const activeTotal = freshness.reduce((sum, row) => sum + row.active_count, 0);
  const staleTotal = freshness.reduce((sum, row) => sum + row.stale_count, 0);
  const selectedPoint = catalog?.items.find((point) => point.id === selectedPointId) ?? catalog?.items[0] ?? null;

  useEffect(() => {
    if (!catalog?.items.length) {
      setSelectedPointId(null);
      return;
    }
    if (!selectedPointId || !catalog.items.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(catalog.items[0].id);
    }
  }, [catalog, selectedPointId]);

  return (
    <AppShell>
      <main className="page map-page">
        <PageHeader
          eyebrow="EV charging map"
          title="Charging point discovery"
          description="Search the aggregated catalog by viewport, inspect provider freshness, and open a reservation flow without calling provider APIs from the browser."
        />

        <section className="metric-strip" aria-label="Catalog freshness">
          <MetricCard label="Points in bounds" value={catalog?.total ?? 0} />
          <MetricCard label="Active catalog points" value={activeTotal} tone="success" />
          <MetricCard label="Stale catalog points" value={staleTotal} tone="warning" />
          <MetricCard label="Without coordinates" value={catalog?.missing_coordinates_count ?? 0} tone="info" />
        </section>

        <section className="map-workspace">
          <aside className="map-results-panel" aria-label="Charging point filters and results">
            <MapFilterPanel filters={filters} providers={PROVIDERS} statuses={STATUSES} onChange={setFilters} />
            <SelectedFiltersBar filters={filters} onChange={setFilters} />
            <div className="results-summary">
              <strong>{catalog?.items.length ?? 0} results</strong>
              <span>{catalog?.bounds_applied ? "Viewport bounded" : "No bounds applied"}</span>
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
                  Lat {bounds.minLat.toFixed(3)}-{bounds.maxLat.toFixed(3)} · Lng {bounds.minLng.toFixed(3)}-{bounds.maxLng.toFixed(3)} · Zoom {bounds.zoom}
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
            />
            {catalog ? (
              <CatalogMap points={catalog.items} bounds={bounds} selectedPointId={selectedPoint?.id} />
            ) : (
              <LoadingBlock label="Loading map" />
            )}
          </section>

          <ChargingPointDrawer point={selectedPoint} bounds={bounds} />
        </section>
      </main>
    </AppShell>
  );
}
