import { describe, expect, it } from "vitest";

import { formatPrice } from "../lib/formatting";
import { ATHENS_DEFAULT_BOUNDS, buildCatalogPointsPath } from "../lib/routing";

describe("frontend helpers", () => {
  it("builds gateway-only catalog paths with viewport bounds", () => {
    const path = buildCatalogPointsPath(ATHENS_DEFAULT_BOUNDS, {
      q: "syntagma",
      providerCode: "redPlug",
      status: "available",
      connector: "CCS",
      includeStale: false,
    });

    expect(path).toContain("/api/catalog/points?");
    expect(path).toContain("minLat=");
    expect(path).toContain("maxLng=");
    expect(path).toContain("providerCode=redPlug");
    expect(path).toContain("status=available");
    expect(path).not.toContain("includeStale=true");
  });

  it("formats missing prices for EV users", () => {
    expect(formatPrice(null)).toBe("Price unavailable");
  });
});
