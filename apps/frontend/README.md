# frontend

The `frontend` app is the single role-based React + TypeScript + Vite
application for saasPlug.

## Purpose

It will serve public/auth pages, EV user flows, provider administrator flows,
and operator flows.

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

## Docker baseline

Prompt 02 adds a minimal Vite development container for the local Compose
baseline.

Important files:

- `Dockerfile`
- `.dockerignore`
- `package.json`
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/App.css`
- `vite.config.ts`
- `tsconfig.json`

The container listens on internal port `5173`. It is not exposed directly to
the host. Browser access should go through `nginx-gateway` on
`http://localhost:8080/`.

The current UI is a neutral infrastructure placeholder only. It does not
implement login, role routing, maps, dashboards, reservations, analytics, or
billing.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
