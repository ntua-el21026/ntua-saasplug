# frontend

`apps/frontend` is the single role-based React + TypeScript + Vite browser app
for saasPlug.

## Runtime

- Compose service: `frontend`
- Development command: `npm run dev`
- Production build command: `npm run build`
- Docker runtime: Vite builds static assets, then `nginx:1.27-alpine` serves
  them on internal port `5173`
- API access: gateway-relative `/api/...` only

The browser must not call Docker service hostnames, provider adapter routes,
external provider APIs, RabbitMQ, or database ports directly.

## Stack

- React 19
- TypeScript
- Vite
- React Router
- MapLibre GL with public OpenFreeMap tiles
- Vitest and Testing Library

## Routes

| Route group | Access | Purpose |
|---|---|---|
| `/`, `/login`, `/register`, `/logout`, `/login/google/callback` | public/auth | Auth and session flow |
| `/profile` | authenticated | Account summary and local-password change |
| `/map`, `/dashboard`, `/reservations` | `EV_USER` | Map search, reservation creation/history, EV summary |
| `/points/:providerCode/:externalPointId` | EV, provider admin for own provider, operator | Point detail and status lookup |
| `/provider/*` | `PROVIDER_ADMIN` | Provider dashboard, points, analytics, invoices, export, settings |
| `/operator/*` | `OPERATOR` | Providers, analytics, catalog, invoices, pricing, sync/scheduler, system |

## API Behavior

- `src/lib/api.ts` rejects calls that do not start with `/api/`.
- Catalog map search is built in `src/lib/routing.ts` using viewport-derived
  `centerLat`, `centerLng`, `radiusKm`, `limit`, and `offset`.
- Status helpers in `src/lib/statusLookups.ts` use cache-only batch reads for
  visible points and live lookup/refresh for selected points.
- Reservation creation calls
  `/api/reservations/points/{providerCode}/{externalPointId}/reservations` and
  sends an idempotency key.

## Important Files

| Path | Purpose |
|---|---|
| `src/App.tsx` | Routes, guards, lazy page loading |
| `src/features/auth/` | Login, register, Google callback, profile, logout |
| `src/features/catalog/` | Map/list search, point detail, status, reservation form |
| `src/features/admin/` | Provider and operator workspaces |
| `src/features/reservations/` | EV reservation history |
| `src/lib/` | API client, routing helpers, storage, status lookup helpers |
| `src/test/` | Vitest tests |
| `Dockerfile`, `nginx.conf` | Static build and Nginx runtime |

## Environment

Frontend build variables are `VITE_*` values and are browser-delivered. The
Compose build currently passes:

| Variable | Purpose |
|---|---|
| `VITE_PUBLIC_BASE_URL` | Public base URL used by the built app |
| `VITE_DEMO_LOGIN_PASSWORD` | Optional demo-only password prefill |

Do not place real provider, JWT, database, RabbitMQ, or OAuth secrets in
frontend code or `VITE_*` variables.

## Commands

```bash
npm install
npm run dev
npm test -- --run
npm run build
npm run lint
```

`npm run preview` serves the built app locally on port `5173`; Docker Compose
uses the Nginx runtime instead.
