import type { Bounds, CatalogFilters, CatalogSearchCircleResponse } from "./types";

export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 17;
export const CATALOG_POINTS_PAGE_LIMIT = 500;
export const CATALOG_RESULT_LIMIT_OPTIONS = [20, 40, 80, 160, 320, "all"] as const;
const DEFAULT_RADIUS_AT_ZOOM_15_KM = 0.5;
const MIN_CATALOG_QUERY_RADIUS_KM = 0.05;
const MAX_CATALOG_QUERY_RADIUS_KM = 10;

export type CatalogResultLimit = (typeof CATALOG_RESULT_LIMIT_OPTIONS)[number];
export type MapCenter = { lat: number; lng: number };
export type CatalogSearchCircle = { centerLat: number; centerLng: number; radiusKm: number };

export const ATHENS_DEFAULT_BOUNDS: Bounds = boundsFromCenter({ lat: 37.985, lng: 23.78 }, 15);

export function buildCatalogPointsPath(bounds: Bounds, filters: CatalogFilters, limit = CATALOG_POINTS_PAGE_LIMIT, offset = 0): string {
  const circle = catalogSearchCircle(bounds);
  const params = new URLSearchParams({
    centerLat: String(circle.centerLat),
    centerLng: String(circle.centerLng),
    radiusKm: String(circle.radiusKm),
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
  const scale = 2 ** (bounds.zoom - zoom);
  return boundsFromCenter(boundsCenter(bounds), zoom, bounds.radiusKm * scale);
}

export function boundsCenter(bounds: Bounds): MapCenter {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

export function boundsFromCenter(center: MapCenter, zoom: number, radiusKm = fallbackCatalogRadiusKm(zoom)): Bounds {
  const normalizedZoom = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, zoom));
  const normalizedRadiusKm = normalizeCatalogRadiusKm(radiusKm);
  const latRadius = normalizedRadiusKm / 111.32;
  const lngRadius = normalizedRadiusKm / (111.32 * Math.max(0.2, Math.cos(toRadians(center.lat))));

  return {
    minLat: center.lat - latRadius,
    maxLat: center.lat + latRadius,
    minLng: center.lng - lngRadius,
    maxLng: center.lng + lngRadius,
    zoom: normalizedZoom,
    radiusKm: normalizedRadiusKm,
  };
}

export function catalogQueryRadiusKm(bounds: Bounds): number {
  return normalizeCatalogRadiusKm(bounds.radiusKm);
}

export function catalogSearchCircle(bounds: Bounds): CatalogSearchCircle {
  const center = boundsCenter(bounds);
  return {
    centerLat: center.lat,
    centerLng: center.lng,
    radiusKm: catalogQueryRadiusKm(bounds),
  };
}

export function boundsFromCatalogSearchCircle(circle: CatalogSearchCircleResponse, zoom: number): Bounds {
  return boundsFromCenter({ lat: circle.center_lat, lng: circle.center_lng }, zoom, circle.radius_km);
}

export function pointWithinCatalogSearchCircle(
  point: { latitude: number | null; longitude: number | null },
  bounds: Bounds,
): boolean {
  if (point.latitude === null || point.longitude === null) {
    return false;
  }
  const circle = catalogSearchCircle(bounds);
  return distanceKm(
    { lat: circle.centerLat, lng: circle.centerLng },
    { lat: point.latitude, lng: point.longitude },
  ) <= circle.radiusKm + 1e-9;
}

export function sameCatalogSearchCircle(a: Bounds, b: Bounds): boolean {
  const aCircle = catalogSearchCircle(a);
  const bCircle = catalogSearchCircle(b);
  return (
    Math.abs(aCircle.centerLat - bCircle.centerLat) < 0.000001 &&
    Math.abs(aCircle.centerLng - bCircle.centerLng) < 0.000001 &&
    Math.abs(aCircle.radiusKm - bCircle.radiusKm) < 0.000001 &&
    Math.abs(a.zoom - b.zoom) < 0.0001
  );
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function distanceKm(a: MapCenter, b: MapCenter): number {
  const earthRadiusKm = 6371.0088;
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function fallbackCatalogRadiusKm(zoom: number): number {
  return normalizeCatalogRadiusKm(DEFAULT_RADIUS_AT_ZOOM_15_KM * 2 ** (15 - zoom));
}

function normalizeCatalogRadiusKm(radiusKm: number): number {
  return Math.max(MIN_CATALOG_QUERY_RADIUS_KM, Math.min(MAX_CATALOG_QUERY_RADIUS_KM, radiusKm));
}
