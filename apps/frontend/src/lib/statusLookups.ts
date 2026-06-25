import { requestJson } from "./api";
import type { CatalogPoint, StatusBatchLookupItem, StatusBatchLookupResponse, StatusLookupResponse } from "./types";

const STATUS_BATCH_LIMIT = 500;

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
  return fetchStatusBatches("/api/status/points/statuses", uniquePoints, accessToken, signal, forceRefresh);
}

export async function fetchCachedPointStatuses(
  points: Array<Pick<CatalogPoint, "provider_code" | "external_point_id">>,
  accessToken: string | null | undefined,
  signal?: AbortSignal,
): Promise<StatusBatchLookupResponse> {
  const uniquePoints = uniqueStatusLookupItems(points);
  return fetchStatusBatches("/api/status/cache/statuses", uniquePoints, accessToken, signal);
}

export async function fetchPointStatus(
  point: Pick<CatalogPoint, "provider_code" | "external_point_id">,
  accessToken: string | null | undefined,
  signal?: AbortSignal,
  forceRefresh = false,
): Promise<StatusLookupResponse> {
  return requestJson<StatusLookupResponse>(
    `/api/status/points/${encodeURIComponent(point.provider_code)}/${encodeURIComponent(point.external_point_id)}/status?forceRefresh=${forceRefresh ? "true" : "false"}`,
    { accessToken, signal },
  );
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

async function fetchStatusBatches(
  path: "/api/status/points/statuses" | "/api/status/cache/statuses",
  points: StatusBatchLookupItem[],
  accessToken: string | null | undefined,
  signal?: AbortSignal,
  forceRefresh?: boolean,
): Promise<StatusBatchLookupResponse> {
  if (!points.length) {
    return { items: [], errors: [] };
  }

  const responses = await Promise.all(
    chunkStatusLookupItems(points).map((batch) => requestJson<StatusBatchLookupResponse>(path, {
      method: "POST",
      accessToken,
      signal,
      bodyJson: {
        points: batch,
        ...(forceRefresh === undefined ? {} : { force_refresh: forceRefresh }),
      },
    })),
  );

  return {
    items: responses.flatMap((response) => response.items),
    errors: responses.flatMap((response) => response.errors),
  };
}

function chunkStatusLookupItems(points: StatusBatchLookupItem[]): StatusBatchLookupItem[][] {
  const chunks: StatusBatchLookupItem[][] = [];
  for (let start = 0; start < points.length; start += STATUS_BATCH_LIMIT) {
    chunks.push(points.slice(start, start + STATUS_BATCH_LIMIT));
  }
  return chunks;
}
