import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import type { EvReservationSummary, Reservation, Role, User } from "../lib/types";

const STORAGE_KEY = "saasplug.ev.session";

describe("App", () => {
  afterEach(() => {
    cleanup();
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
    expect(screen.getByText("Try a role")).toBeInTheDocument();
    expect(screen.queryByText(/presenter-provided password/i)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /map of nearby ev charging points in athens/i })).toBeInTheDocument();
    expect(screen.getByText(/power your drive, wherever the road takes you/i)).toBeInTheDocument();
    expect(screen.queryByText(/gateway-only saas cockpit/i)).not.toBeInTheDocument();

    const passwordInput = screen.getByLabelText("Password", { selector: "input" });
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveValue("");
    await userEvent.type(passwordInput, "presenter-provided-password");
    await userEvent.click(screen.getByRole("button", { name: /operator/i }));
    expect(passwordInput).toHaveValue("presenter-provided-password");
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
    const currentPassword = screen.getByLabelText(/current password/i, { selector: "input" });
    expect(currentPassword).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: /show current password/i }));
    expect(currentPassword).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: /hide current password/i }));
    expect(currentPassword).toHaveAttribute("type", "password");
    expect(screen.queryByText(/^account$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/local demo accounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/signed-in identity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/role-aware entry points/i)).not.toBeInTheDocument();
    view.unmount();
  });

  it("hides password changes for Google sessions", async () => {
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
  });

  it("shows password changes for local provider and operator profiles", async () => {
    const providerUser = profileUser("PROVIDER_ADMIN");
    storeUserSession(providerUser);
    mockMe(providerUser);
    window.history.pushState({}, "", "/profile");
    const providerView = render(<App />);

    expect(await screen.findByRole("heading", { name: /provider_admin@saasplug.local/i })).toBeInTheDocument();
    expect(screen.getAllByText("Red provider admin").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument();

    providerView.unmount();
    window.localStorage.clear();
    const operatorUser = profileUser("OPERATOR");
    storeUserSession(operatorUser);
    mockMe(operatorUser);
    window.history.pushState({}, "", "/profile");
    const operatorView = render(<App />);

    expect(await screen.findByRole("heading", { name: /operator@saasplug.local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument();
    operatorView.unmount();
  });

  it("submits provider password changes through the authenticated auth endpoint", async () => {
    const providerUser = profileUser("PROVIDER_ADMIN");
    storeUserSession(providerUser);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/auth/auth/me") {
        return new Response(
          JSON.stringify(providerUser),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        );
      }
      if (path === "/api/auth/auth/password") {
        return new Response(
          JSON.stringify({ status: "password_changed_relogin_required" }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        );
      }
      return new Response(JSON.stringify({ detail: "Unexpected test request" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/profile");

    const view = render(<App />);

    expect(await screen.findByRole("heading", { name: /provider_admin@saasplug.local/i })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/current password/i, { selector: "input" }), "change-me-demo-password");
    await userEvent.type(screen.getByLabelText(/^new password/i, { selector: "input" }), "new-provider-password");
    await userEvent.type(screen.getByLabelText(/confirm new password/i, { selector: "input" }), "new-provider-password");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
    const passwordCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/auth/auth/password");
    expect(passwordCall).toBeDefined();
    const passwordRequest = passwordCall?.[1] as RequestInit;
    expect(passwordRequest.method).toBe("POST");
    expect(new Headers(passwordRequest.headers).get("Authorization")).toBe("Bearer test-access-token");
    expect(JSON.parse(String(passwordRequest.body))).toEqual({
      current_password: "change-me-demo-password",
      new_password: "new-provider-password",
    });
    view.unmount();
  });

  it("asks for confirmation before signing out", async () => {
    const evUser = profileUser("EV_USER");
    storeUserSession(evUser);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/auth/auth/me") {
        return new Response(
          JSON.stringify(evUser),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        );
      }
      if (path === "/api/auth/auth/logout") {
        return new Response(
          JSON.stringify({ status: "logged_out" }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        );
      }
      return new Response(JSON.stringify({ detail: "Unexpected test request" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/logout");

    const view = render(<App />);

    expect(await screen.findByRole("dialog", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close sign out/i })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^sign out$/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
    view.unmount();
  });

  it("limits reservations inside a scrollable history panel", async () => {
    const evUser = profileUser("EV_USER");
    const reservations = Array.from({ length: 45 }, (_, index) => reservationFixture(index + 1));
    storeUserSession(evUser);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path === "/api/auth/auth/me") {
          return new Response(
            JSON.stringify(evUser),
            { headers: { "Content-Type": "application/json" }, status: 200 },
          );
        }
        if (path === "/api/reservations/reservations/me") {
          return new Response(
            JSON.stringify(reservations),
            { headers: { "Content-Type": "application/json" }, status: 200 },
          );
        }
        if (path === "/api/analytics/ev/reservations/summary") {
          const summary = reservationSummaryFixture(reservations.length);
          summary.missing_estimate_count = 2;
          return new Response(
            JSON.stringify(summary),
            { headers: { "Content-Type": "application/json" }, status: 200 },
          );
        }
        return new Response(JSON.stringify({ detail: "Unexpected test request" }), { status: 500 });
      }),
    );
    window.history.pushState({}, "", "/reservations");

    const view = render(<App />);

    expect(await screen.findByText("Showing 20 of 45")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /open point/i })).toHaveLength(20);
    expect(screen.queryByText(/successful reservations are missing cost/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/show/i), "40");
    expect(await screen.findByText("Showing 40 of 45")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /open point/i })).toHaveLength(40);

    await userEvent.selectOptions(screen.getByLabelText(/show/i), "all");
    expect(await screen.findByText("Showing 45 of 45")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /open point/i })).toHaveLength(45);
    view.unmount();
  });

  it("completes the Google callback and stores the EV session", async () => {
    const googleUser = profileUser("EV_USER", {
      email: "google-callback@example.com",
      auth_provider: "google",
      last_login_method: "google",
      password_change_supported: false,
    });
    window.history.pushState({}, "", "/login/google/callback?code=google-code&state=oauth-state");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/api/auth/auth/google/callback?")) {
        const params = new URLSearchParams(path.split("?")[1]);
        expect(params.get("code")).toBe("google-code");
        expect(params.get("state")).toBe("oauth-state");
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

  it("completes the backend Google callback handoff without a second token exchange", async () => {
    const googleUser = profileUser("EV_USER", {
      email: "google-fragment@example.com",
      auth_provider: "google",
      last_login_method: "google",
      password_change_supported: false,
    });
    const payload = {
      access_token: "fragment-access-token",
      refresh_token: "fragment-refresh-token",
      token_type: "bearer",
      expires_in: 1800,
      user: googleUser,
    };
    const encodedPayload = window.btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    window.history.pushState({}, "", `/login/google/callback#payload=${encodedPayload}`);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith("/api/auth/auth/google/callback")) {
        return new Response(JSON.stringify({ detail: "Token exchange should not be called" }), { status: 500 });
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
      expect(storedSession.user?.email).toBe("google-fragment@example.com");
      expect(storedSession.accessToken).toBe("fragment-access-token");
    });
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/auth/auth/google/callback"))).toBe(false);
    expect(window.location.hash).toBe("");
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

function reservationFixture(index: number): Reservation {
  return {
    id: `reservation-${index}`,
    user_id: "ev-user-id",
    user_email: "evuser@saasplug.local",
    provider_code: index % 2 === 0 ? "greenPlug" : "redPlug",
    external_point_id: String(1000 + index),
    normalized_point_id: `redPlug:${1000 + index}`,
    catalog_point_id: `catalog-${index}`,
    requested_duration_minutes: 30,
    status: "succeeded",
    provider_status: "reserved",
    provider_reservation_id: `provider-reservation-${index}`,
    reservation_ends_at: "2026-06-23T12:30:00Z",
    price_per_kwh_eur: 0.5,
    charger_capacity_kw: 22,
    estimated_energy_kwh: 11,
    estimated_cost_eur: 5.5,
    estimated_cost_currency: "EUR",
    estimate_basis: "rated_power_duration_estimate",
    failure_reason: null,
    created_at: `2026-06-23T12:${String(index % 60).padStart(2, "0")}:00Z`,
    updated_at: `2026-06-23T12:${String(index % 60).padStart(2, "0")}:00Z`,
  };
}

function reservationSummaryFixture(total: number): EvReservationSummary {
  return {
    user_id: "ev-user-id",
    total_reservations: total,
    successful_reservations: total,
    failed_reservations: 0,
    total_duration_minutes: total * 30,
    distinct_points: total,
    estimated_reservations: total,
    missing_estimate_count: 0,
    total_estimated_energy_kwh: total * 11,
    total_estimated_cost_eur: total * 5.5,
    average_estimated_cost_per_point_eur: 5.5,
    average_estimated_cost_per_reservation_eur: 5.5,
    currency: "EUR",
    estimate_basis: "rated_power_duration_estimate",
    last_event_ingested_at: "2026-06-23T12:00:00Z",
    last_aggregate_computed_at: "2026-06-23T12:05:00Z",
    analytics_delay_notice: "aggregates_current",
  };
}
