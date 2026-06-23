import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import type { Role, User } from "../lib/types";

const STORAGE_KEY = "saasplug.ev.session";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("renders the login route with production account copy", async () => {
    window.history.pushState({}, "", "/login");

    const view = render(<App />);

    expect(await screen.findByRole("heading", { name: /sign in to saasplug/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.queryByText(/secure session/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create ev account/i })).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("link", { name: /provider entry/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redplug admin/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /greenplug admin/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /blueplug admin/i })).toBeInTheDocument();

    const passwordInput = screen.getByLabelText("Password", { selector: "input" });
    expect(passwordInput).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(passwordInput).toHaveAttribute("type", "text");
    view.unmount();
  });

  it("renders the profile route as a professional account overview", async () => {
    storeUserSession(profileUser("EV_USER"));
    mockMe(profileUser("EV_USER"));
    window.history.pushState({}, "", "/profile");

    const view = render(<App />);

    expect(await screen.findByRole("heading", { name: /evuser@saasplug.local/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /profile details/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open charging map/i })).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getAllByText("EV user").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /password/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument();
    expect(screen.queryByText(/^account$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/local demo accounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/signed-in identity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/role-aware entry points/i)).not.toBeInTheDocument();
    view.unmount();
  });

  it("hides password changes for Google EV sessions and non-EV profiles", async () => {
    const googleUser = profileUser("EV_USER", {
      email: "google-ev@example.com",
      auth_provider: "google",
      last_login_method: "google",
      password_change_supported: false,
    });
    storeUserSession(googleUser);
    mockMe(googleUser);
    window.history.pushState({}, "", "/profile");

    const googleView = render(<App />);

    expect(await screen.findByRole("heading", { name: /google-ev@example.com/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /update password/i })).not.toBeInTheDocument();

    googleView.unmount();
    window.localStorage.clear();
    const providerUser = profileUser("PROVIDER_ADMIN");
    storeUserSession(providerUser);
    mockMe(providerUser);
    window.history.pushState({}, "", "/profile");
    const providerView = render(<App />);

    expect(await screen.findByRole("heading", { name: /provider_admin@saasplug.local/i })).toBeInTheDocument();
    expect(screen.getAllByText("Provider admin").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /update password/i })).not.toBeInTheDocument();
    providerView.unmount();
  });

  it("completes the Google callback and stores the EV session", async () => {
    const googleUser = profileUser("EV_USER", {
      email: "google-callback@example.com",
      auth_provider: "google",
      last_login_method: "google",
      password_change_supported: false,
    });
    window.history.pushState({}, "", "/login/google/callback?code=google-code");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/api/auth/auth/google/callback?")) {
        const params = new URLSearchParams(path.split("?")[1]);
        expect(params.get("code")).toBe("google-code");
        expect(params.get("redirect_uri")).toBe(`${window.location.origin}/login/google/callback`);
        return new Response(
          JSON.stringify({
            access_token: "google-access-token",
            refresh_token: "google-refresh-token",
            token_type: "bearer",
            expires_in: 1800,
            user: googleUser,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        );
      }
      if (path === "/api/auth/auth/me") {
        return new Response(
          JSON.stringify(googleUser),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          items: [],
          total: 0,
          limit: 100,
          offset: 0,
          bounds_applied: true,
          missing_coordinates_count: 0,
          search_circle: null,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<App />);

    await waitFor(() => {
      const storedSession = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(storedSession.user?.email).toBe("google-callback@example.com");
      expect(storedSession.user?.auth_provider).toBe("google");
    });
    expect(fetchMock).toHaveBeenCalled();
    view.unmount();
  });
});

function profileUser(role: Role, overrides: Partial<User> = {}): User {
  return {
    id: `${role.toLowerCase()}-id`,
    email: role === "EV_USER" ? "evuser@saasplug.local" : `${role.toLowerCase()}@saasplug.local`,
    roles: [role],
    provider_id: role === "PROVIDER_ADMIN" ? "red-provider-id" : null,
    provider_code: role === "PROVIDER_ADMIN" ? "redPlug" : null,
    auth_provider: "local",
    last_login_method: "local",
    password_change_supported: true,
    ...overrides,
  };
}

function storeUserSession(user: User) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      expiresAt: Date.now() + 60_000,
      user,
    }),
  );
}

function mockMe(user: User) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(
      JSON.stringify(user),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    )),
  );
}
