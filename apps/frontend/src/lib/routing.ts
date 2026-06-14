import type { Bounds, CatalogFilters, CatalogPoint } from "./types";

export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 17;
export const CATALOG_POINTS_PAGE_LIMIT = 500;
export const CATALOG_RESULT_LIMIT_OPTIONS = [20, 40, 80, 160, 320, "all"] as const;
const EARTH_RADIUS_KM = 6371;

export type CatalogResultLimit = (typeof CATALOG_RESULT_LIMIT_OPTIONS)[number];
export type MapCenter = { lat: number; lng: number };

export const CATALOG_QUERY_RADIUS_BY_ZOOM_KM: Record<number, number> = {
  1: 10,
  2: 10,
  3: 10,
  4: 10,
  5: 8,
  6: 7,
  7: 6,
  8: 5,
  9: 4,
  10: 3.4,
  11: 2.8,
  12: 2.4,
  13: 2,
  14: 1.8,
  15: 1.6,
  16: 1.2,
  17: 0.9,
};

export const ATHENS_DEFAULT_BOUNDS: Bounds = boundsFromCenter({ lat: 37.985, lng: 23.78 }, 15);

export function buildCatalogPointsPath(bounds: Bounds, filters: CatalogFilters, limit = CATALOG_POINTS_PAGE_LIMIT, offset = 0): string {
  const params = new URLSearchParams({
    minLat: bounds.minLat.toFixed(5),
    maxLat: bounds.maxLat.toFixed(5),
    minLng: bounds.minLng.toFixed(5),
    maxLng: bounds.maxLng.toFixed(5),
    zoom: String(bounds.zoom),
    limit: String(limit),
    offset: String(offset),
  });

  if (filters.q.trim()) {
    params.set("q", filters.q.trim());
  }
  if (filters.providerCode) {
    params.set("providerCode", filters.providerCode);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.connector.trim()) {
    params.set("connector", filters.connector.trim());
  }
  if (filters.includeStale) {
    params.set("includeStale", "true");
  }

  return `/api/catalog/points?${params.toString()}`;
}

export function pointPath(providerCode: string, externalPointId: string): string {
  return `/points/${encodeURIComponent(providerCode)}/${encodeURIComponent(externalPointId)}`;
}

export function moveBounds(bounds: Bounds, direction: "north" | "south" | "east" | "west"): Bounds {
  const latSpan = bounds.maxLat - bounds.minLat;
  const lngSpan = bounds.maxLng - bounds.minLng;
  const latStep = latSpan * 0.35;
  const lngStep = lngSpan * 0.35;
  const center = boundsCenter(bounds);

  switch (direction) {
    case "north":
      return boundsFromCenter({ ...center, lat: center.lat + latStep }, bounds.zoom);
    case "south":
      return boundsFromCenter({ ...center, lat: center.lat - latStep }, bounds.zoom);
    case "east":
      return boundsFromCenter({ ...center, lng: center.lng + lngStep }, bounds.zoom);
    case "west":
      return boundsFromCenter({ ...center, lng: center.lng - lngStep }, bounds.zoom);
  }
}

export function zoomBounds(bounds: Bounds, mode: "in" | "out"): Bounds {
  const zoom = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, bounds.zoom + (mode === "in" ? 1 : -1)));
  return boundsFromCenter(boundsCenter(bounds), zoom);
}

export function boundsCenter(bounds: Bounds): MapCenter {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

export function boundsFromCenter(center: MapCenter, zoom: number): Bounds {
  const radiusKm = catalogQueryRadiusKm(zoom);
  const latRadius = radiusKm / 111.32;
  const lngRadius = radiusKm / (111.32 * Math.max(0.2, Math.cos(toRadians(center.lat))));

  return {
    minLat: center.lat - latRadius,
    maxLat: center.lat + latRadius,
    minLng: center.lng - lngRadius,
    maxLng: center.lng + lngRadius,
    zoom: Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, Math.round(zoom))),
  };
}

export function catalogQueryRadiusKm(zoom: number): number {
  const clampedZoom = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, Math.round(zoom)));
  return CATALOG_QUERY_RADIUS_BY_ZOOM_KM[clampedZoom] ?? CATALOG_QUERY_RADIUS_BY_ZOOM_KM[MAP_MAX_ZOOM];
}

export function pointWithinCatalogRadius(point: CatalogPoint, bounds: Bounds): boolean {
  if (point.latitude === null || point.longitude === null) {
    return false;
  }
  const center = boundsCenter(bounds);
  return distanceKm(center, { lat: point.latitude, lng: point.longitude }) <= catalogQueryRadiusKm(bounds.zoom);
}

function distanceKm(a: MapCenter, b: MapCenter): number {
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
