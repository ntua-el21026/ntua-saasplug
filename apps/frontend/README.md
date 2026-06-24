# frontend

The `frontend` app is the single role-based React + TypeScript + Vite
application for saasPlug.

## Purpose

It serves public/auth pages, the EV user journey, provider administrator
workspaces, and operator workspaces:

```text
login/register -> role-aware workspace -> EV flows / provider dashboard / operator dashboard
```

## Belongs here

- React components, routes, state management, and API client code.
- Frontend tests and frontend-only assets.
- UI documentation specific to the app.

## Must not be placed here

- Direct calls to internal service ports.
- Direct calls to external provider APIs.
- Backend business logic or persistence code.
- Real secrets or local `.env` files.

## Gateway rule

All frontend API calls must go through `/api/...` routes exposed by
`nginx-gateway`.

Allowed frontend route groups:

```text
/api/auth/*
/api/providers/*
/api/catalog/*
/api/status/*
/api/reservations/*
/api/analytics/*
/api/billing/*
/api/scheduler/*
```

The browser must not call Docker-internal service hostnames, internal service
ports, RabbitMQ, or external provider APIs directly.

## Routes

Implemented frontend routes:

| Route | Purpose |
|---|---|
| `/login` | Email/password login with seeded demo account shortcuts and EV-only Google sign-in |
| `/login/google/callback` | Google OAuth browser callback that completes the backend code exchange and stores the session |
| `/register` | Local EV account registration |
| `/logout` | Session revocation and local session cleanup |
| `/map` | EV map/list search using MapLibre, OpenFreeMap tiles, and bounds-based catalog queries |
| `/dashboard` | Alias to the EV map/list experience |
| `/points/:providerCode/:externalPointId` | Cached catalog point details and live status lookup; reservation controls are EV-only |
| `/reservations` | Current user's reservation history, EV reservation summary metrics, cost/kWh, and estimated cost display |
| `/profile` | User-facing account overview, role-specific workspace links, and local-password changes |
| `/provider/dashboard` | Provider-admin command center with analytics, billing, and catalog posture |
| `/provider/points` | Provider-scoped catalog points with provider-selected fetch-size presets |
| `/provider/analytics` | Provider analytics aggregates, top points, status distribution, trends, and date-range filtering |
| `/provider/invoices` | Provider invoice list and billing exposure |
| `/provider/invoices/:invoiceId` | Invoice detail and mock full-invoice payment |
| `/provider/export` | Provider-scoped usage CSV export |
| `/provider/settings` | Provider metadata, integration metadata, pricing, and audit logs |
| `/operator/dashboard` | Global operator command center |
| `/operator/providers` | Provider-registry management and activation controls |
| `/operator/analytics` | Global analytics aggregate views |
| `/operator/catalog` | Aggregated catalog inspection and import triggers |
| `/operator/invoices` | Operator invoice overview |
| `/operator/invoices/new` | Operator invoice issuance |
| `/operator/invoices/:invoiceId` | Operator invoice detail view |
| `/operator/pricing` | Pricing rule creation and activation controls |
| `/operator/sync` | Scheduler jobs/manual runs, ordered maintenance sequence, pause/resume, individual interval editing, bulk minimum/default interval presets, catalog imports, analytics drains/refreshes, billing drains/outbox publishing, and reservation outbox publishing |
| `/operator/system` | Service health, scheduler health, freshness, and run-history overview |

Authenticated EV routes require `EV_USER`. Provider routes require
`PROVIDER_ADMIN` except invoice detail, which is also readable by `OPERATOR`.
Operator routes require `OPERATOR`.

## Demo users

The login page exposes role shortcut buttons for:

| Email | Role |
|---|---|
| `evuser@saasplug.local` | `EV_USER` |
| `operator@saasplug.local` | `OPERATOR` |
| `red-admin@saasplug.local` | `PROVIDER_ADMIN` |
| `green-admin@saasplug.local` | `PROVIDER_ADMIN` |
| `blue-admin@saasplug.local` | `PROVIDER_ADMIN` |

Only the EV user can access the EV map and reservations pages. Point details
are readable by EV users, provider administrators for their own provider, and
operators; reservation creation remains EV-only. Provider administrators are
scoped to their own provider. Operators can access global management and
control pages.

The demo password is not read from frontend environment variables, embedded in
the bundle, rendered, or prefilled by the app. It comes from the server-side
`DEMO_USER_PASSWORD` used by auth-service seed data and must be provided
out-of-band by the presenter. The role shortcut buttons fill the email and keep
the current password input value, so a presenter can type the shared demo
password once without exposing it through browser-delivered configuration.

Google sign-in is available only for EV accounts. In local demo mode, where
Google credentials are placeholders, the login page uses
`/api/auth/auth/google/local-sign-in` with the typed email address to simulate a
Google-verified account: new emails become EV users, existing EV users sign in
to the same account, and operator/provider-admin emails are rejected. When real
Google credentials are configured, the same button redirects to Google's
authorization URL returned by `auth-service`. Real OAuth uses the backend
gateway callback configured by `GOOGLE_REDIRECT_URI`; that backend URL must be
allowed in the Google OAuth client configuration. Auth-service generates and
validates OAuth `state` and PKCE verifier/challenge values for the configured
flow. After the backend exchanges the code, it redirects the browser to
`/login/google/callback` with a session handoff fragment, and the callback page
stores the session and clears the fragment from the address bar.

The profile page shows password changes for local password accounts whose
current session was not signed in with Google. A successful password change
revokes active refresh tokens and clears the browser session, requiring the
user to sign in again. Google-only accounts do not show the password form.

## Frontend architecture

Important files:

| Path | Purpose |
|---|---|
| `src/App.tsx` | Browser routes and route guards |
| `src/features/auth/` | Session handling, login, registration, logout, and profile UI |
| `src/features/admin/` | Provider-admin and operator dashboards, controls, tables, and charts |
| `src/features/catalog/` | Bounds-based point search, map/list UI, details, status lookup, and reservation form |
| `src/features/reservations/` | Current user's reservation history |
| `src/components/` | Shared shell, access-denied, feedback, and status components |
| `src/lib/api.ts` | Gateway-only JSON/text API client |
| `src/lib/routing.ts` | Catalog query and point-route helpers |
| `src/lib/storage.ts` | Local session persistence |
| `src/styles/app.css` | Responsive application styling |
| `src/test/` | Vitest and Testing Library tests |

The map surface uses `maplibre-gl` with the public OpenFreeMap style at
`https://tiles.openfreemap.org/styles/liberty`. OpenFreeMap does not require an
API key, registration, or frontend secret. The browser still reads charging
points only from gateway-relative catalog routes and never calls provider APIs
directly.

Route-level code splitting keeps admin pages, catalog pages, point details,
reservation history, profile, and the MapLibre-backed map out of the initial
auth/landing bundle. The MapLibre dependency remains a large lazy chunk, which
is accepted for the MVP because the map is loaded only when EV catalog routes
are opened.

The EV map derives its search circle from the rendered MapLibre viewport, not
from a fixed zoom-to-kilometers table. On pan or zoom, the frontend computes a
circle that occupies a stable percentage of the visible map, sends
`centerLat`, `centerLng`, and `radiusKm` to `/api/catalog/points`, and renders
only the rows returned inside that same circle. The catalog response echoes the
applied `search_circle`; the blue radius overlay and radius text are driven by
that committed response circle when points are displayed. As a fail-closed
guard, the frontend applies the same Haversine circle check before rendering
cards or markers, so broad or stale responses cannot place points outside the
blue circle.

## EV reservation cost display

The reservations page uses two gateway-backed sources:

- `/api/reservations/reservations/me` for reservation records;
- `/api/analytics/ev/reservations/summary` for EV-scoped aggregate summary
  cards.

Reservation history is shown in a scrollable panel with display presets for
20, 40, 60, 80, 100, or the full list of loaded records.

Reservation cards label the provider energy price as `Cost/kWh`, because the
stored field is `price_per_kwh_eur`. The `Estimated cost` field is displayed
only when the backend has all required inputs: cost/kWh, charger capacity in
kW, and requested duration. Missing, negative, or non-finite inputs render as
unavailable rather than `0` or a malformed currency value.

Reserved points show reservation timing wherever the frontend has that data:
map/list point cards and point detail/status panels show the reserved-until
time, while reservation history and successful reservation dialogs show the
created-to-end reservation window.

The top summary metrics prioritize average estimated cost per point. That
metric is backed by analytics-service aggregates and uses only points with at
least one valid estimate, so missing cost/kWh or capacity fields do not depress
the average.

The UI does not show the missing-input count as a separate sentence. Missing
estimate inputs remain excluded by analytics-service and unavailable values
remain explicit in reservation cards.

Reservation result dialogs have one close control in the modal header. Alerts
inside the dialog are non-dismissible so a second close icon is not rendered.
Reservation submissions send a generated `Idempotency-Key` header to
`reservation-service`. The key exists only for the active submission, which
prevents duplicate in-flight form submissions. A completed failed request gets
a new key when the EV user explicitly retries it. Ambiguous provider outcomes,
such as timeouts or invalid provider success payloads, do not expose immediate
fresh-key retry. The dialog directs the user to reservation history before
sending a new provider mutation.

## Refresh ownership

EV-user and provider-admin pages do not expose refresh buttons. This includes
point status, reservation statistics, provider analytics, and provider billing
pages. These views read the latest projections maintained by status-service,
analytics-service, and billing-service.

Operator Analytics exposes `Refresh stats`. It calls
`POST /api/analytics/operator/refresh?limit=100`, which asks analytics-service
to consume a bounded RabbitMQ batch and then rebuild all analytics aggregates.
Existing Operator Sync controls remain available for separate queue drains,
aggregate refreshes, and the full ordered maintenance sequence.

Provider `Tracked revenue` is estimated EV charging revenue, not the provider's
SaaS invoice amount. It totals successful-reservation charging estimates using
the reservation's explicit estimate or cost/kWh, charger power, and duration.
Provider invoice pages separately show fees charged by the operator.

## Commands

Run frontend checks locally inside `apps/frontend/`:

```bash
npm install
npm run test
npm run build
```

Run the same checks through Docker Compose from the repository root:

```bash
docker compose run --build --rm --no-deps frontend npm test -- --run
docker compose run --build --rm --no-deps frontend npm run build
```

Browser access should go through the gateway:

```text
http://localhost:8080/
```

The latest final verification evidence is recorded in
`docs/final-verification.md`.

## Docker baseline

The frontend Docker image builds production Vite assets in a Node build stage
and serves the static `dist/` output with Nginx on internal port `5173`. It is
not exposed directly to the host. Browser access should go through
`nginx-gateway` on `http://localhost:8080/`.

Important files:

- `Dockerfile`
- `nginx.conf`
- `.dockerignore`
- `package.json`
- `package-lock.json`
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/styles/app.css`
- `vite.config.ts`
- `tsconfig.json`

## Current limitations

- Status and reservation actions depend on the backend services and seeded
  provider/catalog data being available through Docker Compose.
- Dashboard content depends on the corresponding backend aggregates, invoices,
  import runs, and health endpoints being available through the gateway.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/architecture-summary.md`
- `docs/final-verification.md`
