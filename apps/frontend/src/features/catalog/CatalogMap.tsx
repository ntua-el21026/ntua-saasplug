import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";

import { AvailabilityLegend } from "../../components/domain/ev";
import { ProviderBadge } from "../../components/domain/provider";
import { ChargingPointStatusBadge } from "../../components/domain/status";
import { formatCapacity, formatDateTime, formatPrice, providerLabel } from "../../lib/formatting";
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, boundsCenter, boundsFromCenter, pointPath } from "../../lib/routing";
import type { Bounds, CatalogPoint } from "../../lib/types";

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
type MapLibreRuntime = typeof import("maplibre-gl");

export function CatalogMap({
  points,
  bounds,
  selectedPointId,
  onSelectPoint,
  onClosePoint,
  onBoundsChange,
}: {
  points: CatalogPoint[];
  bounds: Bounds;
  selectedPointId?: string | null;
  onSelectPoint: (pointId: string) => void;
  onClosePoint: () => void;
  onBoundsChange: (bounds: Bounds) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreRuntime | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const programmaticMoveRef = useRef(false);
  const initialBoundsRef = useRef(bounds);
  const latestSelectRef = useRef(onSelectPoint);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const plotted = useMemo(
    () => points.filter((point) => point.latitude !== null && point.longitude !== null),
    [points],
  );
  const selectedPoint = plotted.find((point) => point.id === selectedPointId) ?? null;

  useEffect(() => {
    latestSelectRef.current = onSelectPoint;
  }, [onSelectPoint]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let disposed = false;
    let handleMoveEnd: (() => void) | null = null;
    let handleError: (() => void) | null = null;

    void import("maplibre-gl")
      .then((module) => {
        if (disposed || !containerRef.current) {
          return;
        }

        const maplibre = module;
        maplibreRef.current = maplibre;

        const map = new maplibre.Map({
          attributionControl: { compact: true },
          container: containerRef.current,
          style: OPENFREEMAP_STYLE_URL,
          center: mapCenter(initialBoundsRef.current),
          zoom: initialBoundsRef.current.zoom,
          maxZoom: MAP_MAX_ZOOM,
          minZoom: MAP_MIN_ZOOM,
        });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibre.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");

        handleMoveEnd = () => {
          if (programmaticMoveRef.current) {
            programmaticMoveRef.current = false;
            return;
          }
          onBoundsChange(boundsFromMap(map));
        };
        handleError = () => {
          setMapError("The map tiles are temporarily unavailable. Charging point data is still available in the result list.");
        };

        map.on("moveend", handleMoveEnd);
        map.on("error", handleError);
        markProgrammaticMove(programmaticMoveRef);
        fitMapToBounds(map, initialBoundsRef.current);
        setMapReady(true);
      })
      .catch(() => {
        if (!disposed) {
          setMapError("The map renderer could not be loaded. Charging point data is still available in the result list.");
        }
      });

    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      const map = mapRef.current;
      if (map) {
        if (handleMoveEnd) {
          map.off("moveend", handleMoveEnd);
        }
        if (handleError) {
          map.off("error", handleError);
        }
        map.remove();
      }
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, [onBoundsChange]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !mapReady) {
      return;
    }

    const current = boundsFromMap(map);
    if (!sameBounds(current, bounds)) {
      markProgrammaticMove(programmaticMoveRef);
      fitMapToBounds(map, bounds);
    }
  }, [bounds]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !mapReady) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = plotted.map((point) => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = `maplibre-point-marker provider-${point.provider_code}${selectedPointId === point.id ? " is-selected" : ""}`;
      marker.setAttribute("aria-label", `Show ${point.display_name} details`);
      marker.title = point.display_name;
      marker.addEventListener("click", () => latestSelectRef.current(point.id));

      const markerInner = document.createElement("span");
      markerInner.className = "maplibre-point-marker-inner";
      marker.appendChild(markerInner);

      return new maplibre.Marker({ anchor: "center", element: marker })
        .setLngLat([point.longitude as number, point.latitude as number])
        .addTo(map);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [plotted, selectedPointId, mapReady]);

  return (
    <div className="map-frame" aria-label="Charging point map">
      <div className="map-viewport">
        <div
          ref={containerRef}
          className="maplibre-map"
          role="application"
          aria-label={`${plotted.length} charging points in current center radius`}
        />
        <div className="map-radius-indicator" aria-hidden="true" />
        {mapError ? (
          <div className="map-service-warning" role="status">
            {mapError}
          </div>
        ) : null}
        {!plotted.length ? (
          <div className="map-empty-overlay">
            <strong>No mapped points</strong>
            <span>Try a wider viewport or clear filters.</span>
          </div>
        ) : null}
        {selectedPoint ? (
          <ChargingPointMapPanel point={selectedPoint} bounds={bounds} onClose={onClosePoint} />
        ) : null}
      </div>
      <AvailabilityLegend />
    </div>
  );
}

function ChargingPointMapPanel({
  point,
  bounds,
  onClose,
}: {
  point: CatalogPoint;
  bounds: Bounds;
  onClose: () => void;
}) {
  return (
    <section className="map-point-panel" aria-label={`${point.display_name} quick details`}>
      <button className="map-point-panel-close" type="button" onClick={onClose} aria-label="Close charging point details">
        x
      </button>
      <div className="map-point-panel-header">
        <ProviderBadge providerCode={point.provider_code} />
        <ChargingPointStatusBadge status={point.status} />
      </div>
      <h3>{point.display_name}</h3>
      <p>{point.address ?? point.location_name ?? point.normalized_point_id}</p>
      <dl className="map-point-panel-details">
        <div>
          <dt>Point ID</dt>
          <dd>{point.normalized_point_id}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{providerLabel(point.provider_code)}</dd>
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
        <div>
          <dt>Viewport</dt>
          <dd>Zoom {bounds.zoom} out of {MAP_MAX_ZOOM}</dd>
        </div>
      </dl>
      <Link className="button-primary button-link" to={pointPath(point.provider_code, point.external_point_id)}>
        Reserve charger
      </Link>
    </section>
  );
}

function fitMapToBounds(map: MapLibreMap, bounds: Bounds) {
  map.fitBounds(
    [
      [bounds.minLng, bounds.minLat],
      [bounds.maxLng, bounds.maxLat],
    ],
    { duration: 0, maxZoom: bounds.zoom, padding: 48 },
  );
}

function markProgrammaticMove(ref: { current: boolean }) {
  ref.current = true;
  window.setTimeout(() => {
    ref.current = false;
  }, 120);
}

function boundsFromMap(map: MapLibreMap): Bounds {
  const center = map.getCenter();
  const zoom = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, Math.round(map.getZoom())));
  return boundsFromCenter({ lat: center.lat, lng: center.lng }, zoom);
}

function mapCenter(bounds: Bounds): [number, number] {
  const center = boundsCenter(bounds);
  return [center.lng, center.lat];
}

function sameBounds(a: Bounds, b: Bounds): boolean {
  const epsilon = 0.0001;
  return (
    Math.abs(a.minLat - b.minLat) < epsilon &&
    Math.abs(a.maxLat - b.maxLat) < epsilon &&
    Math.abs(a.minLng - b.minLng) < epsilon &&
    Math.abs(a.maxLng - b.maxLng) < epsilon &&
    a.zoom === b.zoom
  );
}
