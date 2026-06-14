# auth-service

## Responsibility

`auth-service` owns authentication and authorization metadata for saasPlug.
It is the source of truth for local users, password hashes, JWT access token
claims, refresh tokens, roles, and provider-admin logical scope.

It owns only the `auth-postgres` database. It must not own provider business
metadata, catalog data, reservations, analytics, billing, or frontend screens.

## Runtime

The service is a Python FastAPI application served by Uvicorn on internal port
`8000`.

Gateway exposure:

```text
/api/auth/... -> auth-service:8000
```

The Nginx gateway strips `/api/auth/`, so service routes under `/auth/...` are
reached through `/api/auth/auth/...`.

## Persistence

The service uses deterministic startup table creation for MVP/local
development. This is intentionally simple and should be replaced by
service-local Alembic migrations if schema evolution becomes non-trivial.

Owned tables:

```text
users
refresh_tokens
```

`users` stores:

- UUID user ID,
- normalized email,
- bcrypt password hash,
- active flag,
- roles array,
- provider-admin `provider_id` and `provider_code` scope where applicable,
- created/updated timestamps.

`refresh_tokens` stores only hashed refresh tokens, expiration, revocation
time, and timestamps. Plain refresh tokens are returned to clients only once
when issued.

## Demo Users

Demo users are seeded idempotently at startup. The demo password comes from
`DEMO_USER_PASSWORD` and defaults to the safe local placeholder in
`.env.example`.

| Email | Role | Provider scope |
|---|---|---|
| `operator@saasplug.local` | `OPERATOR` | none |
| `evuser@saasplug.local` | `EV_USER` | none |
| `red-admin@saasplug.local` | `PROVIDER_ADMIN` | `redPlug` |
| `green-admin@saasplug.local` | `PROVIDER_ADMIN` | `greenPlug` |
| `blue-admin@saasplug.local` | `PROVIDER_ADMIN` | `bluePlug` |

Provider-admin `provider_id` values are deterministic UUIDv5 logical IDs
derived from the provider code.

## Endpoints

Infrastructure endpoints:

| Method | Service path | Gateway path | Purpose |
|---|---|---|---|
| `GET` | `/` | `/api/auth/` | service metadata |
| `GET` | `/health` | `/api/auth/health` | container health |
| `GET` | `/ready` | `/api/auth/ready` | readiness metadata |

Auth endpoints:

| Method | Service path | Gateway path | Purpose |
|---|---|---|---|
| `POST` | `/auth/register` | `/api/auth/auth/register` | public EV user registration |
| `POST` | `/auth/login` | `/api/auth/auth/login` | JSON email/password login |
| `POST` | `/auth/refresh` | `/api/auth/auth/refresh` | issue a new JWT access token from a valid refresh token |
| `POST` | `/auth/logout` | `/api/auth/auth/logout` | revoke a refresh token idempotently |
| `GET` | `/auth/me` | `/api/auth/auth/me` | return the current bearer-token user |
| `GET` | `/auth/require-operator` | `/api/auth/auth/require-operator` | development role-check endpoint |
| `GET` | `/auth/require-provider-admin` | `/api/auth/auth/require-provider-admin` | development provider-scope endpoint |
| `GET` | `/auth/google/login` | `/api/auth/auth/google/login` | Google OAuth hook |
| `GET` | `/auth/google/callback` | `/api/auth/auth/google/callback` | Google OAuth callback hook |

Public registration always creates an `EV_USER`. It ignores any attempted role
or provider-scope escalation in the request body.

## Tokens

Login and registration return:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "...",
    "email": "evuser@saasplug.local",
    "roles": ["EV_USER"],
    "provider_id": null,
    "provider_code": null
  }
}
```

JWT access tokens include:

```text
sub
email
roles
provider_id
provider_code
exp
```

Refresh tokens are persisted hashed. The refresh endpoint returns the same
still-valid refresh token with a new access token. `POST /auth/logout` revokes
the refresh token and subsequent refresh attempts fail.

## Google OAuth Local Behavior

`GET /auth/google/login` and `GET /auth/google/callback` are safe hooks. When
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_REDIRECT_URI` are
placeholder values, the endpoints return non-500 JSON explaining that Google
OAuth is not configured in local demo mode.

When configured, `/auth/google/login` builds a standards-compatible Google
authorization URL. Actual Google token exchange is intentionally deferred.

No real Google credentials must be committed.

## Local Commands

Run the full local stack:

```bash
docker compose up -d --build
```

Login through the gateway:

```bash
curl -X POST http://localhost:8080/api/auth/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"operator@saasplug.local","password":"change-me-demo-password"}'
```

Call `/auth/me` with an access token:

```bash
curl http://localhost:8080/api/auth/auth/me \
  -H "Authorization: Bearer <access-token>"
```

Run auth-service tests:

```bash
docker compose build auth-service
docker compose run --rm --no-deps auth-service pytest -q
```

Stop and remove local development volumes:

```bash
docker compose down -v
```

## Environment

Relevant variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | auth-service database connection, mapped from `AUTH_DATABASE_URL` in Compose |
| `JWT_SECRET` | JWT signing secret; placeholder only in `.env.example` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | access token lifetime |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | refresh token lifetime |
| `DEMO_USER_PASSWORD` | safe local demo password placeholder |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID placeholder |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret placeholder |
| `GOOGLE_REDIRECT_URI` | gateway callback URL |

Do not commit real secrets or `.env`.

## Boundary Notes

- Public registration always creates `EV_USER`; it does not allow role or
  provider-scope escalation.
- Real Google token exchange is not part of the local MVP. The OAuth endpoints
  provide safe configuration and callback hooks.
- Provider metadata, catalog data, status cache, reservations, analytics, and
  billing are owned by their respective services.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
