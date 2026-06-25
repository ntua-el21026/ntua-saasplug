import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";

import { AvailabilityLegend } from "../../components/domain/ev";
import { ProviderBadge } from "../../components/domain/provider";
import { ChargingPointStatusBadge } from "../../components/domain/status";
import { formatCapacity, formatCostPerKwh, formatDateTime, formatReservedUntil, providerLabel } from "../../lib/formatting";
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, boundsCenter, boundsFromCenter, catalogQueryRadiusKm, pointPath } from "../../lib/routing";
import type { Bounds, CatalogPoint } from "../../lib/types";

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const RADIUS_SOURCE_ID = "catalog-radius";
const RADIUS_FILL_LAYER_ID = "catalog-radius-fill";
const RADIUS_LINE_LAYER_ID = "catalog-radius-line";
const EARTH_RADIUS_KM = 6371;
type MapLibreRuntime = typeof import("maplibre-gl");
type RadiusGeoJson = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, never>;
    geometry: {
      type: "Polygon";
      coordinates: Array<Array<[number, number]>>;
    };
  }>;
};

export function CatalogMap({
  points,
  bounds,
  searchBounds,
  selectedPointId,
  onSelectPoint,
  onClosePoint,
  onBoundsChange,
  layoutMode = "standard",
  loading = false,
}: {
  points: CatalogPoint[];
  bounds: Bounds;
  searchBounds?: Bounds;
  selectedPointId?: string | null;
  onSelectPoint: (pointId: string) => void;
  onClosePoint: () => void;
  onBoundsChange: (bounds: Bounds) => void;
  layoutMode?: "standard" | "fullscreen";
  loading?: boolean;
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
  const [legendOpen, setLegendOpen] = useState(false);
  const legendPanelId = useId();

  const plotted = useMemo(() => points.filter(pointHasCoordinates), [points]);
  const selectedPoint = plotted.find((point) => point.id === selectedPointId) ?? null;
  const circleBounds = searchBounds ?? bounds;
  const radiusKm = catalogQueryRadiusKm(circleBounds);

  useEffect(() => {
    latestSelectRef.current = onSelectPoint;
  }, [onSelectPoint]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let disposed = false;
    let handleLoad: (() => void) | null = null;
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

        handleLoad = () => {
          const viewportBounds = boundsFromMap(map);
          updateRadiusLayer(map, viewportBounds);
          setMapReady(true);
          onBoundsChange(viewportBounds);
        };
        handleMoveEnd = () => {
          const viewportBounds = boundsFromMap(map);
          updateRadiusLayer(map, viewportBounds);
          if (programmaticMoveRef.current) {
            programmaticMoveRef.current = false;
            onBoundsChange(viewportBounds);
            return;
          }
          onBoundsChange(viewportBounds);
        };
        handleError = () => {
          setMapError("The map tiles are temporarily unavailable. Charging point data is still available in the result list.");
        };

        map.on("load", handleLoad);
        map.on("moveend", handleMoveEnd);
        map.on("error", handleError);
      })
      .catch(() => {
        if (!disposed) {
          setMapError("The map renderer could not be loaded. Charging point data is still available in the result list.");
          onBoundsChange(initialBoundsRef.current);
        }
      });

    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      const map = mapRef.current;
      if (map) {
        if (handleLoad) {
          map.off("load", handleLoad);
        }
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
      jumpMapToBounds(map, bounds);
    }
  }, [bounds]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !mapReady) {
      return;
    }

    updateRadiusLayer(map, circleBounds);
  }, [circleBounds, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const timerId = window.setTimeout(() => {
      map.resize();
      updateRadiusLayer(map, circleBounds);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [circleBounds, layoutMode, mapReady]);

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
      marker.dataset.pointId = point.id;
      marker.dataset.provider = point.provider_code;
      marker.style.setProperty("--map-marker-color", providerMarkerColor(point.provider_code));
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
        <div className="map-radius-label" aria-label="Current catalog radius">
          {radiusKm.toFixed(1)} km radius
        </div>
        <MapLegendControl
          open={legendOpen}
          panelId={legendPanelId}
          onToggle={() => setLegendOpen((current) => !current)}
        />
        {mapError ? (
          <div className="map-service-warning" role="status">
            {mapError}
          </div>
        ) : null}
        {!loading && !plotted.length ? (
          <div className="map-empty-overlay">
            <strong>No mapped points</strong>
            <span>Try a wider viewport or clear filters.</span>
          </div>
        ) : null}
        {selectedPoint ? (
          <ChargingPointMapPanel point={selectedPoint} bounds={bounds} onClose={onClosePoint} />
        ) : null}
      </div>
    </div>
  );
}

function MapLegendControl({
  open,
  panelId,
  onToggle,
}: {
  open: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const label = open ? "Hide provider marker legend" : "Show provider marker legend";
  return (
    <div className={`map-legend-control ${open ? "is-open" : ""}`}>
      {open ? (
        <div id={panelId} className="map-legend-panel">
          <AvailabilityLegend className="map-legend-list" />
        </div>
      ) : null}
      <button
        type="button"
        className="map-legend-toggle"
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={onToggle}
      >
        <span className="map-legend-toggle-icon" aria-hidden="true">
          <span className="map-legend-toggle-dot legend-redPlug" />
          <span className="map-legend-toggle-dot legend-greenPlug" />
          <span className="map-legend-toggle-dot legend-bluePlug" />
        </span>
      </button>
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

function jumpMapToBounds(map: MapLibreMap, bounds: Bounds) {
  map.jumpTo({
    center: mapCenter(bounds),
    zoom: bounds.zoom,
  });
}

function updateRadiusLayer(map: MapLibreMap, bounds: Bounds) {
  const data = radiusGeoJson(bounds);
  const existingSource = map.getSource(RADIUS_SOURCE_ID) as GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(data as Parameters<GeoJSONSource["setData"]>[0]);
    return;
  }

  map.addSource(RADIUS_SOURCE_ID, {
    type: "geojson",
    data: data as Parameters<GeoJSONSource["setData"]>[0],
  });
  map.addLayer({
    id: RADIUS_FILL_LAYER_ID,
    type: "fill",
    source: RADIUS_SOURCE_ID,
    paint: {
      "fill-color": "#2563eb",
      "fill-opacity": 0.12,
    },
  });
  map.addLayer({
    id: RADIUS_LINE_LAYER_ID,
    type: "line",
    source: RADIUS_SOURCE_ID,
    paint: {
      "line-color": "#2563eb",
      "line-opacity": 0.74,
      "line-width": 3,
    },
  });
}

function radiusGeoJson(bounds: Bounds): RadiusGeoJson {
  const center = boundsCenter(bounds);
  const radiusKm = catalogQueryRadiusKm(bounds);
  const coordinates: Array<[number, number]> = [];
  for (let bearing = 0; bearing <= 360; bearing += 4) {
    coordinates.push(destinationPoint(center.lat, center.lng, radiusKm, bearing));
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
      },
    ],
  };
}

function destinationPoint(lat: number, lng: number, distanceKm: number, bearingDegrees: number): [number, number] {
  const earthRadiusKm = 6371;
  const angularDistance = distanceKm / earthRadiusKm;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(lat);
  const lng1 = toRadians(lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance)
      + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  );
  return [toDegrees(lng2), toDegrees(lat2)];
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

function searchRadiusKmFromMap(map: MapLibreMap): number {
  const center = map.getCenter();
  const bounds = map.getBounds();
  return Math.min(
    distanceKm({ lat: center.lat, lng: center.lng }, { lat: bounds.getNorth(), lng: center.lng }),
    distanceKm({ lat: center.lat, lng: center.lng }, { lat: bounds.getSouth(), lng: center.lng }),
    distanceKm({ lat: center.lat, lng: center.lng }, { lat: center.lat, lng: bounds.getEast() }),
    distanceKm({ lat: center.lat, lng: center.lng }, { lat: center.lat, lng: bounds.getWest() }),
  );
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function providerMarkerColor(providerCode: CatalogPoint["provider_code"]): string {
  switch (providerCode) {
    case "redPlug":
      return "#ef4444";
    case "greenPlug":
      return "#10b981";
    case "bluePlug":
      return "#2563eb";
  }
}

function pointHasCoordinates(point: CatalogPoint): point is CatalogPoint & { latitude: number; longitude: number } {
  return point.latitude !== null && point.longitude !== null;
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
  return boundsFromCenter({ lat: center.lat, lng: center.lng }, zoom, searchRadiusKmFromMap(map));
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
    a.zoom === b.zoom &&
    Math.abs(a.radiusKm - b.radiusKm) < 0.005
  );
}
