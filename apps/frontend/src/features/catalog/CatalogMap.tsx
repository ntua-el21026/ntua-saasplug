import { Link } from "react-router-dom";

import { AvailabilityLegend, ChargingPointMarker } from "../../components/domain/ev";
import { formatPrice, providerLabel } from "../../lib/formatting";
import { pointPath } from "../../lib/routing";
import type { Bounds, CatalogPoint } from "../../lib/types";
import { StatusBadge } from "../../components/StatusBadge";

export function CatalogMap({
  points,
  bounds,
  selectedPointId,
}: {
  points: CatalogPoint[];
  bounds: Bounds;
  selectedPointId?: string | null;
}) {
  const plotted = points.filter((point) => point.latitude !== null && point.longitude !== null);

  return (
    <div className="map-frame" aria-label="Charging point map">
      <svg viewBox="0 0 100 72" role="img" aria-label={`${plotted.length} charging points in current bounds`}>
        <defs>
          <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#CBD5E1" strokeWidth="0.25" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100" height="72" className="map-land" />
        <rect x="0" y="0" width="100" height="72" fill="url(#grid)" opacity="0.45" />
        <path className="map-road major" d="M6 56 C23 43 33 44 46 28 C59 12 75 18 94 8" />
        <path className="map-road" d="M8 20 C25 25 36 31 49 38 C66 48 78 46 94 57" />
        <path className="map-road" d="M18 67 C30 51 38 44 50 36 C62 28 72 20 83 6" />
        {plotted.map((point) => {
          const x = (((point.longitude as number) - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
          const y = 72 - (((point.latitude as number) - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 72;
          return (
            <Link key={point.id} to={pointPath(point.provider_code, point.external_point_id)} aria-label={point.display_name}>
              <ChargingPointMarker point={point} x={x} y={y} selected={selectedPointId === point.id} />
            </Link>
          );
        })}
      </svg>
      <AvailabilityLegend />
      <div className="map-preview-list">
        {plotted.slice(0, 3).map((point) => (
          <Link key={point.id} to={pointPath(point.provider_code, point.external_point_id)} className="map-preview-item">
            <span>
              <strong>{point.display_name}</strong>
              <small>{providerLabel(point.provider_code)} · {formatPrice(point.price_per_kwh_eur)}</small>
            </span>
            <StatusBadge status={point.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
