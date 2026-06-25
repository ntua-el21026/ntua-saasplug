# auth-service

## Purpose

Owns users, local email/password auth, Google OAuth handoff, JWT access tokens,
refresh tokens, roles, and provider-admin scope claims.

## Runtime

- Compose service: `auth-service`
- Container port: `8000`
- Database: `auth-postgres`
- Main app: `app/main.py`
- Gateway prefix: `/api/auth/*`; auth router prefix makes login paths look like
  `/api/auth/auth/login`

## Responsibilities

- Seed demo users without overwriting existing local account state by default.
- Register EV users.
- Issue and refresh JWT sessions.
- Revoke refresh tokens on logout and password change.
- Store OAuth state and PKCE verifier data for Google login.
- Return current-user and role/scope validation responses.

## API Surface

| Scope | Method/path | Purpose |
|---|---|---|
| Public | `POST /auth/register` | Register an EV user |
| Public | `POST /auth/login` | Local email/password login |
| Public | `POST /auth/refresh` | Refresh session tokens |
| Public | `POST /auth/logout` | Revoke refresh token |
| Authenticated | `POST /auth/password` | Change local password |
| Authenticated | `GET /auth/me` | Current user |
| Authenticated | `GET /auth/require-operator` | Operator guard helper |
| Authenticated | `GET /auth/require-provider-admin` | Provider-admin guard helper |
| Public | `GET /auth/google/login` | Start Google OAuth |
| Public | `POST /auth/google/local-sign-in` | Local demo Google sign-in for EV accounts |
| Public | `GET /auth/google/callback` | Google OAuth callback |
| Health | `GET /health`, `GET /ready` | Service health |

## Persistence

| Table | Purpose |
|---|---|
| `users` | User accounts, roles, provider scope, auth provider fields |
| `refresh_tokens` | Hashed refresh tokens and revocation state |
| `oauth_states` | Google OAuth state hash and PKCE verifier lifecycle |

## Messaging

This service does not publish or consume RabbitMQ events in the current
implementation.

## Dependencies

- Calls: Google OAuth endpoints when real credentials are configured.
- Called by: frontend through `nginx-gateway`; other services validate JWTs
  locally using shared secret/config.
- External systems: optional Google OAuth provider.

## Tests

```bash
docker compose run --build --rm --no-deps auth-service pytest -q
```
