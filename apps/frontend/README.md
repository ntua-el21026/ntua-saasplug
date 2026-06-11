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

Application logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
