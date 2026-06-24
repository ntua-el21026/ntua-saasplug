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
- sign-in provider metadata (`auth_provider`, optional `google_subject`, and
  `last_login_method`),
- active flag,
- roles array,
- provider-admin `provider_id` and `provider_code` scope where applicable,
- created/updated timestamps.

`refresh_tokens` stores only hashed refresh tokens, expiration, revocation
time, and timestamps. Plain refresh tokens are returned to clients only once
when issued.

## Demo Users

Demo users are seeded idempotently at startup. By default, startup inserts
missing demo users but does not overwrite existing user roles, provider scopes,
password hashes, or active flags. Set `RESET_DEMO_USERS_ON_STARTUP=true` only
for an intentional local/demo reset back to the canonical seed values. The demo
password comes from `DEMO_USER_PASSWORD` and defaults to the safe local
placeholder in `.env.example`.

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
| `POST` | `/auth/password` | `/api/auth/auth/password` | change the password for the current local password account |
| `GET` | `/auth/me` | `/api/auth/auth/me` | return the current bearer-token user |
| `GET` | `/auth/require-operator` | `/api/auth/auth/require-operator` | development role-check endpoint |
| `GET` | `/auth/require-provider-admin` | `/api/auth/auth/require-provider-admin` | development provider-scope endpoint |
| `GET` | `/auth/google/login` | `/api/auth/auth/google/login` | Google OAuth hook |
| `GET` | `/auth/google/callback` | `/api/auth/auth/google/callback` | Google OAuth callback hook |
| `POST` | `/auth/google/local-sign-in` | `/api/auth/auth/google/local-sign-in` | local/demo Google sign-in simulation for EV users only |

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
    "provider_code": null,
    "auth_provider": "local",
    "last_login_method": "local",
    "password_change_supported": true
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

## Google OAuth Behavior

`GET /auth/google/login` and `GET /auth/google/callback` are safe hooks. When
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_REDIRECT_URI` are
placeholder values, the endpoints return non-500 JSON explaining that Google
OAuth is not configured in local demo mode.

When configured, `/auth/google/login` builds a standards-compatible Google
authorization URL and `/auth/google/callback` exchanges the authorization code
with Google, reads the verified OpenID Connect userinfo response, and signs in
the matching user.

Real Google OAuth uses the backend callback in `GOOGLE_REDIRECT_URI`; that URL
must be registered in the Google OAuth client configuration. After a successful
code exchange, the backend redirects the browser to
`GOOGLE_FRONTEND_CALLBACK_URI` with a session payload in the URL fragment. The
React callback page stores the session and clears the fragment from the address
bar. The callback endpoint still accepts `redirect_uri` for
legacy/manual code-exchange tests, but normal browser login should use the
backend callback to avoid Google `redirect_uri_mismatch` errors.

Google sign-in is EV-only:

- if the Google email does not exist, `auth-service` creates an `EV_USER`
  account with `auth_provider=google`;
- if the Google email belongs to an existing `EV_USER`, the same account is
  signed in and `last_login_method` becomes `google`;
- if the Google email belongs to an `OPERATOR` or `PROVIDER_ADMIN`, the request
  is rejected with HTTP 403.

For local demos without real Google credentials,
`POST /auth/google/local-sign-in` accepts an email address and applies the same
EV-only account provisioning rules. This endpoint is disabled when real Google
OAuth credentials are configured.

## Password Changes

`POST /auth/password` requires a bearer token, the current password, and a new
password. It is supported for all local password accounts, including EV users,
provider admins, and operators. Google-created accounts cannot change a password
until a password login flow is explicitly added for them.

The frontend exposes the password-change form on local-password profiles whose
current session was not signed in with Google, including EV users, provider
admins, and operators.

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
| `GOOGLE_REDIRECT_URI` | backend OAuth callback URL registered in Google Console |
| `GOOGLE_FRONTEND_CALLBACK_URI` | browser route that receives the post-exchange frontend handoff |
| `RESET_DEMO_USERS_ON_STARTUP` | optional local/demo reset of existing seeded accounts |
| `SAASPLUG_STRICT_SECRETS` | rejects unsafe placeholder secrets when enabled |
| `APP_ENV` | production-like values enable strict placeholder validation |

Do not commit real secrets or `.env`.
When `SAASPLUG_STRICT_SECRETS=true` or `APP_ENV` is production-like,
placeholder JWT and demo-password values are rejected at startup.

## Boundary Notes

- Public registration always creates `EV_USER`; it does not allow role or
  provider-scope escalation.
- Real Google OAuth uses the configured Google client ID/secret and exchanges
  authorization codes in `auth-service`; local demo mode uses the explicit
  local sign-in endpoint instead.
- Provider metadata, catalog data, status cache, reservations, analytics, and
  billing are owned by their respective services.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
