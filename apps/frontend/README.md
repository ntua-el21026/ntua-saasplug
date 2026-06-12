# frontend

The `frontend` app is the single role-based React + TypeScript + Vite
application for saasPlug.

## Purpose

It serves public/auth pages and, as of Prompt 12, the EV user journey:

```text
login/register -> map/search/list -> point details -> status lookup -> reservation -> my reservations/profile
```

Provider administrator and operator dashboards remain Prompt 13 scope.

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

Allowed EV frontend route groups for Prompt 12:

```text
/api/auth/*
/api/catalog/*
/api/status/*
/api/reservations/*
```

The browser must not call Docker-internal service hostnames, internal service
ports, RabbitMQ, or external provider APIs directly.

## Routes

Implemented EV frontend routes:

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

Authenticated EV routes require an `EV_USER` role. Non-EV authenticated users
are kept on the profile page until provider/operator dashboards are added.

## Demo users

Use the local demo password from `.env.example`:

```text
change-me-demo-password
```

Prompt 12 exposes quick-fill buttons for:

| Email | Role |
|---|---|
| `evuser@saasplug.local` | `EV_USER` |
| `operator@saasplug.local` | `OPERATOR` |
| `red-admin@saasplug.local` | `PROVIDER_ADMIN` |

Only the EV user can access the EV map, point details, and reservations pages.

## Frontend architecture

Important files:

| Path | Purpose |
|---|---|
| `src/App.tsx` | Browser routes and route guards |
| `src/features/auth/` | Session handling, login, registration, logout, and profile UI |
| `src/features/catalog/` | Bounds-based point search, map/list UI, details, status lookup, and reservation form |
| `src/features/reservations/` | Current user's reservation history |
| `src/components/` | Shared shell, feedback, and status components |
| `src/lib/api.ts` | Gateway-only JSON API client |
| `src/lib/routing.ts` | Catalog query and point-route helpers |
| `src/lib/storage.ts` | Local session persistence |
| `src/styles/app.css` | Responsive application styling |
| `src/test/` | Vitest and Testing Library tests |

The map surface is a local SVG/CSS visualization over the catalog result set.
It intentionally avoids external map providers, API keys, and direct provider
API calls.

## Commands

```bash
npm install
npm run test
npm run build
```

Through Docker Compose, browser access should go through the gateway:

```text
http://localhost:8080/
```

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

- Provider administrator dashboards are not implemented yet.
- Operator dashboards are not implemented yet.
- Billing, pricing, invoice, analytics dashboard, provider settings, and
  operator sync controls are not implemented in the frontend yet.
- Status and reservation actions depend on the backend services and seeded
  provider/catalog data being available through Docker Compose.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
