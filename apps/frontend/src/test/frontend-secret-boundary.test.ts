import { describe, expect, it } from "vitest";

import viteConfigSource from "../../vite.config.ts?raw";

const browserSources = import.meta.glob<string>([
  "../**/*.{ts,tsx}",
  "!../test/**",
], {
  eager: true,
  import: "default",
  query: "?raw",
});

const forbiddenBrowserEnvNames = [
  "DEMO_USER_PASSWORD",
  "VITE_DEMO_USER_PASSWORD",
  "VITE_DEMO_EV_USER_PASSWORD",
  "VITE_DEMO_PROVIDER_ADMIN_PASSWORD",
  "VITE_DEMO_OPERATOR_PASSWORD",
];

describe("frontend secret boundary", () => {
  it("does not reference server-side demo password variables from browser source", () => {
    const sources = {
      ...browserSources,
      "vite.config.ts": viteConfigSource,
    };

    for (const [filePath, contents] of Object.entries(sources)) {
      for (const envName of forbiddenBrowserEnvNames) {
        expect(contents, `${envName} must not be referenced by ${filePath}`).not.toContain(envName);
      }
    }
  });
});
