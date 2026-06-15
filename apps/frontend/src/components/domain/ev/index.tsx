import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { Button, Card, Drawer, EmptyState, FilterChip, Modal, SearchInput, Select } from "../../ui";
import { formatCapacity, formatDateTime, formatPrice, providerLabel } from "../../../lib/formatting";
import { pointPath, type CatalogResultLimit } from "../../../lib/routing";
import type { Bounds, CatalogFilters, CatalogPoint, ProviderCode, Reservation, StatusValue } from "../../../lib/types";
import { ProviderBadge } from "../provider";
import { ChargingPointStatusBadge } from "../status";

export function ChargingPointCard({
  point,
  selected,
  onSelect,
}: {
  point: CatalogPoint;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <article className={`charging-point-card ${selected ? "is-selected" : ""}`}>
      <button
        aria-label={`Show ${point.display_name} on map`}
        className="charging-point-card-button"
        onClick={onSelect}
        type="button"
      >
        <span className={`provider-rail provider-${point.provider_code}`} />
        <span className="point-card-main">
          <strong>{point.display_name}</strong>
          <small>{point.address ?? point.location_name ?? point.normalized_point_id}</small>
          <span className="point-card-meta">
            {providerLabel(point.provider_code)} · {point.connector ?? "Connector unknown"} · {formatCapacity(point.capacity)}
          </span>
        </span>
        <span className="point-card-side">
          <ChargingPointStatusBadge status={point.status} />
          <small>{formatPrice(point.price_per_kwh_eur)}</small>
        </span>
      </button>
      <Link className="charging-point-card-link" to={pointPath(point.provider_code, point.external_point_id)}>
        Details
      </Link>
    </article>
  );
}

export function ChargingPointDrawer({
  point,
  bounds,
}: {
  point: CatalogPoint | null;
  bounds?: Bounds;
}) {
  if (!point) {
    return (
      <Drawer title="Charging point detail">
        <EmptyState title="No charging point selected">Select a point from the result list to inspect provider, price, power, status, and reservation context.</EmptyState>
      </Drawer>
    );
  }

  return (
    <Drawer title="Charging point detail">
      <div className="charging-point-drawer">
        <ProviderBadge providerCode={point.provider_code} />
        <h3>{point.display_name}</h3>
        <p>{point.address ?? point.location_name ?? point.normalized_point_id}</p>
        <dl className="detail-list">
          <div>
            <dt>Status</dt>
            <dd><ChargingPointStatusBadge status={point.status} /></dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{formatDateTime(point.last_catalog_sync_at)}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{formatPrice(point.price_per_kwh_eur)}</dd>
          </div>
          <div>
            <dt>Power</dt>
            <dd>{formatCapacity(point.capacity)}</dd>
          </div>
          <div>
            <dt>Connector</dt>
            <dd>{point.connector ?? "Connector unknown"}</dd>
          </div>
          {bounds ? (
            <div>
              <dt>Viewport</dt>
              <dd>Zoom {bounds.zoom}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </Drawer>
  );
}

export function ChargingPointMarker({
  point,
  x,
  y,
  selected,
}: {
  point: CatalogPoint;
  x: number;
  y: number;
  selected?: boolean;
}) {
  return (
    <>
      <circle className="map-pin-hit" cx={x} cy={y} r="4.2" />
      <circle className={`map-pin provider-${point.provider_code} ${selected ? "is-selected" : ""}`} cx={x} cy={y} r={selected ? 2.25 : 1.55} />
    </>
  );
}

export function ReservationCard({ reservation }: { reservation: Reservation }) {
  return (
    <article className="reservation-card">
      <div>
        <strong>{providerLabel(reservation.provider_code)} point {reservation.external_point_id}</strong>
        <small>{reservation.normalized_point_id}</small>
      </div>
      <ChargingPointStatusBadge status={reservation.status} />
      <dl className="reservation-meta">
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(reservation.created_at)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{reservation.requested_duration_minutes} min</dd>
        </div>
        <div>
          <dt>Provider status</dt>
          <dd>{reservation.provider_status ?? "unknown"}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{formatPrice(reservation.price_per_kwh_eur)}</dd>
        </div>
      </dl>
      {reservation.failure_reason ? <p className="muted">{reservation.failure_reason}</p> : null}
      <Link to={pointPath(reservation.provider_code, reservation.external_point_id)} className="text-link">
        Open point
      </Link>
    </article>
  );
}

export function ReservationModal({
  open,
  title,
  children,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
}) {
  return <Modal open={open} title={title}>{children}</Modal>;
}

export function MapFilterPanel({
  filters,
  providers,
  statuses,
  resultLimit,
  resultLimitOptions,
  onChange,
  onResultLimitChange,
}: {
  filters: CatalogFilters;
  providers: ProviderCode[];
  statuses: StatusValue[];
  resultLimit: CatalogResultLimit;
  resultLimitOptions: readonly CatalogResultLimit[];
  onChange: (filters: CatalogFilters) => void;
  onResultLimitChange: (limit: CatalogResultLimit) => void;
}) {
  return (
    <Card className="map-filter-panel">
      <label>
        Search
        <SearchInput
          value={filters.q}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
          placeholder="Station, address, connector"
        />
      </label>
      <div className="compact-filter-row">
        {statuses.slice(0, 3).map((status) => (
          <button
            className={`compact-filter ${filters.status === status ? "is-selected" : ""}`}
            key={status}
            onClick={() => onChange({ ...filters, status: filters.status === status ? "" : status })}
            type="button"
          >
            {status}
          </button>
        ))}
      </div>
      <details className="more-filters">
        <summary>More filters</summary>
        <label>
          Provider
          <Select value={filters.providerCode} onChange={(event) => onChange({ ...filters, providerCode: event.target.value as CatalogFilters["providerCode"] })}>
            <option value="">All providers</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>{providerLabel(provider)}</option>
            ))}
          </Select>
        </label>
        <label>
          Status
          <Select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value as CatalogFilters["status"] })}>
            <option value="">Any status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
        </label>
        <label>
          Connector
          <input
            className="ui-input"
            value={filters.connector}
            onChange={(event) => onChange({ ...filters, connector: event.target.value })}
            placeholder="CCS, Type 2"
          />
        </label>
        <label>
          Results to show
          <Select
            value={String(resultLimit)}
            onChange={(event) => {
              const value = event.target.value;
              onResultLimitChange(value === "all" ? "all" : Number(value) as CatalogResultLimit);
            }}
          >
            {resultLimitOptions.map((limit) => (
              <option key={String(limit)} value={String(limit)}>
                {limit === "all" ? "All results" : `${limit} results`}
              </option>
            ))}
          </Select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={filters.includeStale}
            onChange={(event) => onChange({ ...filters, includeStale: event.target.checked })}
          />
          Include stale
        </label>
      </details>
    </Card>
  );
}

export function MapFloatingControls({
  onNorth,
  onSouth,
  onWest,
  onEast,
  onZoomIn,
  onZoomOut,
  zoom,
  minZoom,
  maxZoom,
}: {
  onNorth: () => void;
  onSouth: () => void;
  onWest: () => void;
  onEast: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}) {
  return (
    <div className="map-floating-controls" aria-label="Map viewport controls">
      <div className="map-zoom-scale">Zoom {zoom} out of {maxZoom}</div>
      <Button variant="secondary" size="sm" type="button" onClick={onNorth}>N</Button>
      <Button variant="secondary" size="sm" type="button" onClick={onSouth}>S</Button>
      <Button variant="secondary" size="sm" type="button" onClick={onWest}>W</Button>
      <Button variant="secondary" size="sm" type="button" onClick={onEast}>E</Button>
      <Button variant="secondary" size="sm" type="button" onClick={onZoomIn} disabled={zoom >= maxZoom}>+</Button>
      <Button variant="secondary" size="sm" type="button" onClick={onZoomOut} disabled={zoom <= minZoom}>-</Button>
    </div>
  );
}

export function SelectedFiltersBar({
  filters,
  onChange,
}: {
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
}) {
  const chips: React.ReactNode[] = [];
  if (filters.providerCode) {
    chips.push(<FilterChip key="provider" selected onRemove={() => onChange({ ...filters, providerCode: "" })}>{providerLabel(filters.providerCode)}</FilterChip>);
  }
  if (filters.status) {
    chips.push(<FilterChip key="status" selected onRemove={() => onChange({ ...filters, status: "" })}>{filters.status}</FilterChip>);
  }
  if (filters.connector) {
    chips.push(<FilterChip key="connector" selected onRemove={() => onChange({ ...filters, connector: "" })}>{filters.connector}</FilterChip>);
  }
  if (filters.includeStale) {
    chips.push(<FilterChip key="stale" selected onRemove={() => onChange({ ...filters, includeStale: false })}>include stale</FilterChip>);
  }
  return <div className="selected-filters-bar">{chips.length ? chips : <span>No filters selected</span>}</div>;
}

export function AvailabilityLegend() {
  return (
    <div className="availability-legend" aria-label="Provider marker legend">
      <span><i className="legend-dot legend-redPlug" /> redPlug</span>
      <span><i className="legend-dot legend-greenPlug" /> greenPlug</span>
      <span><i className="legend-dot legend-bluePlug" /> bluePlug</span>
    </div>
  );
}
