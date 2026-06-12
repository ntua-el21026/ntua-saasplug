import type { Bounds, CatalogFilters } from "./types";

export const ATHENS_DEFAULT_BOUNDS: Bounds = {
  minLat: 37.88,
  maxLat: 38.08,
  minLng: 23.58,
  maxLng: 24.02,
  zoom: 11,
};

export function buildCatalogPointsPath(bounds: Bounds, filters: CatalogFilters, limit = 80): string {
  const params = new URLSearchParams({
    minLat: bounds.minLat.toFixed(5),
    maxLat: bounds.maxLat.toFixed(5),
    minLng: bounds.minLng.toFixed(5),
    maxLng: bounds.maxLng.toFixed(5),
    zoom: String(bounds.zoom),
    limit: String(limit),
    offset: "0",
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

  switch (direction) {
    case "north":
      return { ...bounds, minLat: bounds.minLat + latStep, maxLat: bounds.maxLat + latStep };
    case "south":
      return { ...bounds, minLat: bounds.minLat - latStep, maxLat: bounds.maxLat - latStep };
    case "east":
      return { ...bounds, minLng: bounds.minLng + lngStep, maxLng: bounds.maxLng + lngStep };
    case "west":
      return { ...bounds, minLng: bounds.minLng - lngStep, maxLng: bounds.maxLng - lngStep };
  }
}

export function zoomBounds(bounds: Bounds, mode: "in" | "out"): Bounds {
  const factor = mode === "in" ? 0.72 : 1.28;
  const latCenter = (bounds.minLat + bounds.maxLat) / 2;
  const lngCenter = (bounds.minLng + bounds.maxLng) / 2;
  const latHalf = ((bounds.maxLat - bounds.minLat) * factor) / 2;
  const lngHalf = ((bounds.maxLng - bounds.minLng) * factor) / 2;
  return {
    minLat: latCenter - latHalf,
    maxLat: latCenter + latHalf,
    minLng: lngCenter - lngHalf,
    maxLng: lngCenter + lngHalf,
    zoom: Math.max(5, Math.min(17, bounds.zoom + (mode === "in" ? 1 : -1))),
  };
}
