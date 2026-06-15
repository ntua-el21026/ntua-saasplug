import { describe, expect, it } from "vitest";

import { formatPrice } from "../lib/formatting";
import { ATHENS_DEFAULT_BOUNDS, buildCatalogPointsPath, pointWithinCatalogSearchCircle } from "../lib/routing";

describe("frontend helpers", () => {
  it("builds gateway-only catalog paths with the search circle", () => {
    const path = buildCatalogPointsPath(ATHENS_DEFAULT_BOUNDS, {
      q: "syntagma",
      providerCode: "redPlug",
      status: "available",
      connector: "CCS",
      includeStale: false,
    });

    expect(path).toContain("/api/catalog/points?");
    expect(path).toContain("centerLat=");
    expect(path).toContain("centerLng=");
    expect(path).toContain("radiusKm=");
    expect(path).not.toContain("minLat=");
    expect(path).not.toContain("maxLng=");
    expect(path).not.toContain("zoom=");
    expect(path).toContain("providerCode=redPlug");
    expect(path).toContain("status=available");
    expect(path).not.toContain("includeStale=true");
  });

  it("formats missing prices for EV users", () => {
    expect(formatPrice(null)).toBe("Price unavailable");
  });

  it("checks points against the exact catalog search circle", () => {
    expect(pointWithinCatalogSearchCircle({ latitude: 37.985, longitude: 23.78 }, ATHENS_DEFAULT_BOUNDS)).toBe(true);
    expect(pointWithinCatalogSearchCircle({ latitude: 38.05, longitude: 23.78 }, ATHENS_DEFAULT_BOUNDS)).toBe(false);
    expect(pointWithinCatalogSearchCircle({ latitude: null, longitude: 23.78 }, ATHENS_DEFAULT_BOUNDS)).toBe(false);
  });
});
