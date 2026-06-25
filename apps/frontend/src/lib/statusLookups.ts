import { requestJson } from "./api";
import type { CatalogPoint, StatusBatchLookupItem, StatusBatchLookupResponse, StatusLookupResponse } from "./types";

export function statusLookupKey(providerCode: string, externalPointId: string): string {
  return `${providerCode}:${externalPointId}`;
}

export function statusLookupKeyForPoint(point: Pick<CatalogPoint, "provider_code" | "external_point_id">): string {
  return statusLookupKey(point.provider_code, point.external_point_id);
}

export function applyStatusLookup<T extends CatalogPoint>(
  point: T,
  lookup: StatusLookupResponse | null | undefined,
): T {
  return {
    ...point,
    status: lookup?.status ?? "unknown",
    reservation_ends_at: lookup?.reservation_ends_at ?? null,
  };
}

export async function fetchPointStatuses(
  points: Array<Pick<CatalogPoint, "provider_code" | "external_point_id">>,
  accessToken: string | null | undefined,
  signal?: AbortSignal,
  forceRefresh = false,
): Promise<StatusBatchLookupResponse> {
  const uniquePoints = uniqueStatusLookupItems(points);
  if (!uniquePoints.length) {
    return { items: [], errors: [] };
  }

  return requestJson<StatusBatchLookupResponse>("/api/status/points/statuses", {
    method: "POST",
    accessToken,
    signal,
    bodyJson: {
      points: uniquePoints,
      force_refresh: forceRefresh,
    },
  });
}

function uniqueStatusLookupItems(
  points: Array<Pick<CatalogPoint, "provider_code" | "external_point_id">>,
): StatusBatchLookupItem[] {
  const seen = new Set<string>();
  const uniquePoints: StatusBatchLookupItem[] = [];
  points.forEach((point) => {
    const key = statusLookupKeyForPoint(point);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    uniquePoints.push({
      provider_code: point.provider_code,
      external_point_id: point.external_point_id,
    });
  });
  return uniquePoints;
}
