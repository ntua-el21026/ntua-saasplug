import { Link } from "react-router-dom";
import { useState, type ReactNode } from "react";

import { Button, Card, Drawer, EmptyState, FilterChip, Modal, SearchInput, Select } from "../../ui";
import { formatCapacity, formatCostPerKwh, formatDateTime, formatMoney, formatReservationWindow, formatReservedUntil, providerLabel } from "../../../lib/formatting";
import { pointPath, type CatalogResultLimit } from "../../../lib/routing";
import type { Bounds, CatalogFilters, CatalogPoint, ProviderCode, Reservation, StatusValue } from "../../../lib/types";
import { ProviderBadge } from "../provider";
import { ChargingPointStatusBadge } from "../status";

const CHARGER_TYPE_OPTIONS = [
  { value: "", label: "Any charger type" },
  { value: "7", label: "Type 2 / Connector 7" },
  { value: "Type 2", label: "Type 2" },
  { value: "CCS", label: "CCS" },
  { value: "CHAdeMO", label: "CHAdeMO" },
  { value: "Schuko", label: "Schuko" },
  { value: "Tesla", label: "Tesla" },
] as const;

function chargerTypeLabel(value: string): string {
  return CHARGER_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

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
          {point.status === "reserved" && point.reservation_ends_at ? (
            <span className="point-card-reservation">{formatReservedUntil(point.reservation_ends_at)}</span>
          ) : null}
        </span>
        <span className="point-card-side">
          <ChargingPointStatusBadge status={point.status} />
          <small>{formatCostPerKwh(point.price_per_kwh_eur)}</small>
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
        <EmptyState title="No charging point selected">Select a point from the result list to inspect provider, cost, power, status, and reservation context.</EmptyState>
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
          {point.status === "reserved" && point.reservation_ends_at ? (
            <div>
              <dt>Reservation</dt>
              <dd>{formatReservedUntil(point.reservation_ends_at)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Last updated</dt>
            <dd>{formatDateTime(point.last_catalog_sync_at)}</dd>
          </div>
          <div>
            <dt>Cost/kWh</dt>
            <dd>{formatCostPerKwh(point.price_per_kwh_eur)}</dd>
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
  const hasEstimatedCost = typeof reservation.estimated_cost_eur === "number" && Number.isFinite(reservation.estimated_cost_eur) && reservation.estimated_cost_eur >= 0;
  return (
    <article className="reservation-card">
      <div>
        <strong>{providerLabel(reservation.provider_code)} charger</strong>
        <small>Point {reservation.external_point_id}</small>
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
          <dt>Reserved window</dt>
          <dd>{formatReservationWindow(reservation.created_at, reservation.reservation_ends_at)}</dd>
        </div>
        <div>
          <dt>Provider status</dt>
          <dd>{reservation.provider_status ?? "unknown"}</dd>
        </div>
        <div>
          <dt>Cost/kWh</dt>
          <dd>{formatCostPerKwh(reservation.price_per_kwh_eur)}</dd>
        </div>
        <div>
          <dt>Estimated cost</dt>
          <dd>{hasEstimatedCost ? formatMoney(reservation.estimated_cost_eur, reservation.estimated_cost_currency ?? "EUR") : "Estimate unavailable"}</dd>
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
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  return <Modal open={open} title={title} onClose={onClose}>{children}</Modal>;
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
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`map-filter-panel ${expanded ? "is-expanded" : "is-collapsed"}`}>
      <div className="filter-panel-header">
        <div>
          <h2>Filters</h2>
          <p>{expanded ? "Narrow nearby chargers by location, provider, availability, and charger type." : "Expand to refine the visible charging points."}</p>
        </div>
        <button
          aria-expanded={expanded}
          className="filter-panel-toggle"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <span>{expanded ? "Hide filters" : "Show filters"}</span>
          <i aria-hidden="true" />
        </button>
      </div>
      {expanded ? (
        <div className="filter-panel-fields">
          <label className="filter-field filter-field-wide">
            Search
            <SearchInput
              value={filters.q}
              onChange={(event) => onChange({ ...filters, q: event.target.value })}
              placeholder="Station, address, connector"
            />
          </label>
          <fieldset className="filter-fieldset">
            <legend>Availability</legend>
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
          </fieldset>
          <div className="filter-grid">
            <label className="filter-field">
              Provider
              <Select value={filters.providerCode} onChange={(event) => onChange({ ...filters, providerCode: event.target.value as CatalogFilters["providerCode"] })}>
                <option value="">All providers</option>
                {providers.map((provider) => (
                  <option key={provider} value={provider}>{providerLabel(provider)}</option>
                ))}
              </Select>
            </label>
            <label className="filter-field">
              Status
              <Select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value as CatalogFilters["status"] })}>
                <option value="">Any status</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
            </label>
            <label className="filter-field">
              Charger type
              <Select
                value={filters.connector}
                onChange={(event) => onChange({ ...filters, connector: event.target.value })}
              >
                {CHARGER_TYPE_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="filter-field">
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
          </div>
          <div className="filter-footer">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.includeStale}
                onChange={(event) => onChange({ ...filters, includeStale: event.target.checked })}
              />
              Include stale
            </label>
          </div>
        </div>
      ) : null}
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
    chips.push(<FilterChip key="connector" selected onRemove={() => onChange({ ...filters, connector: "" })}>{chargerTypeLabel(filters.connector)}</FilterChip>);
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
