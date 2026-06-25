import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCachedPointStatuses } from "../lib/statusLookups";
import type { CatalogPoint, ProviderCode } from "../lib/types";

describe("status lookup helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("splits cached status lookups into API-sized batches", async () => {
    const batchSizes: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => {
        const body = JSON.parse(String(options?.body)) as {
          points: Array<{ provider_code: ProviderCode; external_point_id: string }>;
        };
        batchSizes.push(body.points.length);
        return new Response(JSON.stringify({
          items: body.points.map((point) => ({
            provider_code: point.provider_code,
            external_point_id: point.external_point_id,
            normalized_point_id: `${point.provider_code}:${point.external_point_id}`,
            status: "available",
            reservation_ends_at: null,
            checked_at: "2026-06-13T00:00:00Z",
            expires_at: "2026-06-13T00:05:00Z",
            cache_hit: true,
            provider_called: false,
            returned_stale: false,
            source: "cache",
            warning: null,
          })),
          errors: [],
        }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }),
    );
    const points = Array.from({ length: 501 }, (_, index) => ({
      provider_code: "greenPlug",
      external_point_id: String(index + 1),
    })) as Array<Pick<CatalogPoint, "provider_code" | "external_point_id">>;

    const response = await fetchCachedPointStatuses(points, "test-access-token");

    expect(batchSizes).toEqual([500, 1]);
    expect(response.items).toHaveLength(501);
  });
});
