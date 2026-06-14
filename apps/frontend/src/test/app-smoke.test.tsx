import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const STORAGE_KEY = "saasplug.ev.session";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("renders the login route with production account copy", async () => {
    window.history.pushState({}, "", "/login");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /sign in to saasplug/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("renders the profile route as a professional account overview", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        expiresAt: Date.now() + 60_000,
        user: {
          id: "ev-user-id",
          email: "evuser@saasplug.local",
          roles: ["EV_USER"],
          provider_id: null,
          provider_code: null,
        },
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(
        JSON.stringify({
          id: "ev-user-id",
          email: "evuser@saasplug.local",
          roles: ["EV_USER"],
          provider_id: null,
          provider_code: null,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      )),
    );
    window.history.pushState({}, "", "/profile");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /evuser@saasplug.local/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /profile details/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open charging map/i })).toBeInTheDocument();
    expect(screen.queryByText(/local demo accounts/i)).not.toBeInTheDocument();
  });
});
