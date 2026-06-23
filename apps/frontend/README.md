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
| `/profile` | User-facing account overview, role-specific workspace links, and EV local-password changes |
| `/provider/dashboard` | Provider-admin command center with analytics, billing, and catalog posture |
| `/provider/points` | Provider-scoped catalog points and status-cache freshness |
| `/provider/analytics` | Provider analytics aggregates, top points, status distribution, and trends |
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
| `/operator/sync` | Scheduler jobs/manual runs, ordered maintenance sequence, pause/resume, interval editing, catalog imports, analytics drains/refreshes, billing drains/outbox publishing, and reservation outbox publishing |
| `/operator/system` | Service health, scheduler health, freshness, and run-history overview |

Authenticated EV routes require `EV_USER`. Provider routes require
`PROVIDER_ADMIN` except invoice detail, which is also readable by `OPERATOR`.
Operator routes require `OPERATOR`.

## Demo users

Use the local demo password from `.env.example`:

```text
change-me-demo-password
```

The login page exposes quick-fill buttons for:

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

Google sign-in is available only for EV accounts. In local demo mode, where
Google credentials are placeholders, the login page uses
`/api/auth/auth/google/local-sign-in` with the typed email address to simulate a
Google-verified account: new emails become EV users, existing EV users sign in
to the same account, and operator/provider-admin emails are rejected. When real
Google credentials are configured, the same button redirects to Google's
authorization URL returned by `auth-service`. The frontend uses
`/login/google/callback` as the browser redirect route and passes that URL to
`auth-service` for both the authorization URL and token exchange. That URL must
be allowed in the Google OAuth client configuration.

The profile page shows password changes only for EV users whose current session
was not signed in with Google. The backend password endpoint still supports all
local password accounts.

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

Reservation cards label the provider energy price as `Cost/kWh`, because the
stored field is `price_per_kwh_eur`. The `Estimated cost` field is displayed
only when the backend has all required inputs: cost/kWh, charger capacity in
kW, and requested duration. Missing, negative, or non-finite inputs render as
unavailable rather than `0` or a malformed currency value.

The top summary metrics prioritize average estimated cost per point. That
metric is backed by analytics-service aggregates and uses only points with at
least one valid estimate, so missing cost/kWh or capacity fields do not depress
the average.

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

The frontend container listens on internal port `5173`. It is not exposed
directly to the host. Browser access should go through `nginx-gateway` on
`http://localhost:8080/`.

Important files:

- `Dockerfile`
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
