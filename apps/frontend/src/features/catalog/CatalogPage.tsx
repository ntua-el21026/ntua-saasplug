import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AppShell } from "../../components/AppShell";
import { Alert, EmptyState, LoadingBlock } from "../../components/Feedback";
import { StatusBadge } from "../../components/StatusBadge";
import { requestJson, messageFromUnknownError } from "../../lib/api";
import { formatCapacity, formatDateTime, formatPrice, providerLabel, PROVIDERS, STATUSES } from "../../lib/formatting";
import { ATHENS_DEFAULT_BOUNDS, buildCatalogPointsPath, moveBounds, pointPath, zoomBounds } from "../../lib/routing";
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

  return (
    <AppShell>
      <main className="page">
        <section className="page-heading">
          <p className="eyebrow">EV dashboard</p>
          <h1>Charging point discovery</h1>
          <p>Search the local aggregated catalog, inspect cached point details, check status, and reserve chargers.</p>
        </section>

        <section className="metric-strip" aria-label="Catalog freshness">
          <div>
            <strong>{catalog?.total ?? 0}</strong>
            <span>points in bounds</span>
          </div>
          <div>
            <strong>{activeTotal}</strong>
            <span>active catalog points</span>
          </div>
          <div>
            <strong>{staleTotal}</strong>
            <span>stale catalog points</span>
          </div>
          <div>
            <strong>{catalog?.missing_coordinates_count ?? 0}</strong>
            <span>without coordinates</span>
          </div>
        </section>

        <section className="catalog-toolbar" aria-label="Catalog filters">
          <label>
            Search
            <input
              type="search"
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Point name, address, ID"
            />
          </label>
          <label>
            Provider
            <select
              value={filters.providerCode}
              onChange={(event) => setFilters((current) => ({ ...current, providerCode: event.target.value as CatalogFilters["providerCode"] }))}
            >
              <option value="">All providers</option>
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{providerLabel(provider)}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as CatalogFilters["status"] }))}
            >
              <option value="">Any status</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Connector
            <input
              value={filters.connector}
              onChange={(event) => setFilters((current) => ({ ...current, connector: event.target.value }))}
              placeholder="CCS, Type 2"
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.includeStale}
              onChange={(event) => setFilters((current) => ({ ...current, includeStale: event.target.checked }))}
            />
            Include stale
          </label>
        </section>

        <section className="map-layout">
          <div className="surface map-surface">
            <div className="surface-header">
              <div>
                <h2>Viewport map</h2>
                <p>
                  Lat {bounds.minLat.toFixed(3)}-{bounds.maxLat.toFixed(3)} · Lng {bounds.minLng.toFixed(3)}-{bounds.maxLng.toFixed(3)}
                </p>
              </div>
              <div className="map-controls" aria-label="Map viewport controls">
                <button type="button" onClick={() => setBounds((current) => moveBounds(current, "north"))}>N</button>
                <button type="button" onClick={() => setBounds((current) => moveBounds(current, "south"))}>S</button>
                <button type="button" onClick={() => setBounds((current) => moveBounds(current, "west"))}>W</button>
                <button type="button" onClick={() => setBounds((current) => moveBounds(current, "east"))}>E</button>
                <button type="button" onClick={() => setBounds((current) => zoomBounds(current, "in"))}>+</button>
                <button type="button" onClick={() => setBounds((current) => zoomBounds(current, "out"))}>-</button>
              </div>
            </div>
            {catalog ? <CatalogMap points={catalog.items} bounds={bounds} /> : <LoadingBlock label="Loading map" />}
          </div>

          <div className="surface list-surface">
            <div className="surface-header">
              <div>
                <h2>Points</h2>
                <p>{catalog?.bounds_applied ? "Loaded with viewport bounds" : "Loaded without viewport bounds"}</p>
              </div>
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
                <Link key={point.id} to={pointPath(point.provider_code, point.external_point_id)} className="point-card">
                  <span className={`provider-rail provider-${point.provider_code}`} />
                  <span className="point-card-main">
                    <strong>{point.display_name}</strong>
                    <small>{point.address ?? point.location_name ?? point.normalized_point_id}</small>
                    <span className="point-card-meta">
                      {providerLabel(point.provider_code)} · {point.connector ?? "Connector unknown"} · {formatCapacity(point.capacity)}
                    </span>
                    {point.coordinate_source === "demo_synthetic" ? (
                      <span className="demo-coordinate-note">Demo map coordinates</span>
                    ) : null}
                  </span>
                  <span className="point-card-side">
                    <StatusBadge status={point.status} />
                    <small>{formatPrice(point.price_per_kwh_eur)}</small>
                    <small>Synced {formatDateTime(point.last_catalog_sync_at)}</small>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
