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
| `/login` | Email/password login with seeded demo account shortcuts and Google OAuth hook status |
| `/register` | Local EV account registration |
| `/logout` | Session revocation and local session cleanup |
| `/map` | EV map/list search using bounds-based catalog queries |
| `/dashboard` | Alias to the EV map/list experience |
| `/points/:providerCode/:externalPointId` | Cached catalog point details, live status lookup, and reservation creation |
| `/reservations` | Current user's reservation history |
| `/profile` | Current session, role, and provider-scope information |
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
| `/operator/sync` | Scheduler jobs/manual runs plus catalog, analytics, billing, and reservation outbox action controls |
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

Only the EV user can access the EV map, point details, and reservations pages.
Provider administrators are scoped to their own provider. Operators can access
global management and control pages.

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

The map surface is a local SVG/CSS visualization over the catalog result set.
It intentionally avoids external map providers, API keys, and direct provider
API calls.

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
