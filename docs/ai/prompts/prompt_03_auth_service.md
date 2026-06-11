# Prompt 03 - Auth Service

## 1. Purpose

Implement the `auth-service` MVP authentication and authorization baseline for saasPlug.

This prompt must build on the existing Prompt 02 Docker Compose and Nginx gateway baseline. It must implement real `auth-service` persistence, email/password authentication, JWT access tokens, refresh tokens, seeded demo users, role/provider scoping helpers, and Google OAuth hook endpoints without implementing unrelated business domains.

The implementation must remain aligned with:

```text
AGENTS.md
docs/specs/SPECIFICATIONS.md
docs/ai/prompts/README.md
```

All repository files, code, comments, tests, README content, and AI logs must be written in English.

## 2. Canonical context to read first

Read these files before changing anything:

```text
AGENTS.md
README.md
.env.example
docker-compose.yml
deploy/nginx/default.conf
docs/specs/SPECIFICATIONS.md
docs/ai/README.md
docs/ai/prompt-log.md
docs/ai/prompts/README.md
docs/ai/codex-runs/_template.md
docs/ai/codex-runs/002-docker-gateway.md
services/README.md
services/auth-service/README.md
services/auth-service/app/main.py
```

If any mandatory file is missing, report it in the run report and stop unless this prompt explicitly asks you to create it.

## 3. Scope

Implement only the `auth-service` and directly required local support files.

Allowed implementation areas:

```text
services/auth-service/
.env.example
README.md
services/auth-service/README.md
docs/ai/prompt-log.md
docs/ai/codex-runs/003-auth-service.md
```

You may minimally adjust `docker-compose.yml` only if strictly required for `auth-service` runtime, migrations, health checks, or safe environment variables. Do not rewrite unrelated services.

You may add tests under:

```text
services/auth-service/tests/
```

You may add service-local migration or initialization files under:

```text
services/auth-service/migrations/
services/auth-service/alembic/
```

Use whichever migration structure is consistent with the existing service scaffold and Python stack, but keep it simple and deterministic.

## 4. Non-goals and forbidden work

Do not implement:

- frontend login/register screens,
- provider-registry business logic,
- provider adapters,
- catalog sync/search,
- status cache logic,
- reservation flow,
- analytics,
- billing,
- RabbitMQ business consumers,
- real Google OAuth token exchange against external services unless safely optional,
- GitHub issue/project/milestone mutations,
- fallback Markdown project-management artifacts,
- real secrets or committed `.env` files.

Do not rename services, roles, provider codes, containers, database ownership, routes, or accepted architecture.

Do not expose internal service ports publicly beyond the existing Compose/gateway baseline.

## 5. Required auth behavior

### 5.1 Service ownership

`auth-service` owns authentication and authorization metadata in `auth-postgres`.

It must not own provider business metadata, catalog data, reservations, analytics, or billing.

### 5.2 Roles

Use the canonical roles exactly:

```text
EV_USER
PROVIDER_ADMIN
OPERATOR
```

Provider admins must carry provider scoping metadata:

```text
provider_id
provider_code
```

Use canonical provider codes exactly:

```text
redPlug
greenPlug
bluePlug
```

### 5.3 Seed users

Seed deterministic local demo users:

| Email | Role | Provider code |
|---|---|---|
| `operator@saasplug.local` | `OPERATOR` | none |
| `evuser@saasplug.local` | `EV_USER` | none |
| `red-admin@saasplug.local` | `PROVIDER_ADMIN` | `redPlug` |
| `green-admin@saasplug.local` | `PROVIDER_ADMIN` | `greenPlug` |
| `blue-admin@saasplug.local` | `PROVIDER_ADMIN` | `bluePlug` |

Use a safe local demo password placeholder in `.env.example`, for example:

```text
DEMO_USER_PASSWORD=change-me-demo-password
```

Passwords must be stored hashed, never plaintext.

Seeding must be idempotent.

### 5.4 Email/password authentication

Implement email/password endpoints sufficient for local/demo use:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

Because the gateway maps `/api/auth/` to the service root, these must be reachable through the gateway as:

```text
POST http://localhost:8080/api/auth/auth/register
POST http://localhost:8080/api/auth/auth/login
POST http://localhost:8080/api/auth/auth/refresh
POST http://localhost:8080/api/auth/auth/logout
GET  http://localhost:8080/api/auth/auth/me
```

If you choose cleaner service routes such as `/register`, `/login`, `/refresh`, `/logout`, `/me`, then document the resulting gateway paths clearly and ensure they are consistent with `deploy/nginx/default.conf`. Do not break the existing `/api/auth/health` smoke test.

Recommended response shape for login/register/refresh:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "...",
    "email": "...",
    "roles": ["EV_USER"],
    "provider_id": null,
    "provider_code": null
  }
}
```

### 5.5 JWT access tokens

Use JWT access tokens with claims including:

```text
sub
email
roles
provider_id
provider_code
exp
```

Use `JWT_SECRET`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, and `JWT_REFRESH_TOKEN_EXPIRE_DAYS` from environment variables.

Do not hard-code production secrets.

### 5.6 Refresh tokens

Refresh tokens must be persisted hashed in `auth-postgres`.

A refresh token must support:

- issuing during login/register,
- exchange for a new access token,
- revocation through logout,
- expiration.

For MVP, rotation is optional. If not rotating refresh tokens, explicitly document the choice.

### 5.7 Authorization helpers

Implement reusable service-local helpers/dependencies for:

- current authenticated user,
- role requirement,
- provider-scope requirement.

Include at least one verification endpoint for local smoke testing, for example:

```text
GET /auth/me
GET /auth/require-operator
GET /auth/require-provider-admin
```

The smoke-test endpoints may be marked as development/demo endpoints if you do not want them to represent final product APIs. They must not grant access without a valid token.

### 5.8 Google OAuth hooks

Implement safe hook endpoints for Google OAuth initiation/callback without requiring real credentials for local tests:

```text
GET /auth/google/login
GET /auth/google/callback
```

Minimum acceptable behavior:

- If `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_REDIRECT_URI` are placeholders/missing, return a clear non-500 JSON response explaining that Google OAuth is not configured in local demo mode.
- If configured, build a standards-compatible authorization redirect URL or leave a clearly documented TODO boundary for the actual token exchange.

Do not commit real Google credentials.

## 6. Data model requirements

Implement a minimal `auth-postgres` schema owned by `auth-service`.

Required persistent entities:

### Users

Fields should include at least:

```text
id
email
password_hash
is_active
created_at
updated_at
```

### User role/provider scope

You may model role/provider scope directly on the user or in related tables. The MVP must support:

```text
roles
provider_id
provider_code
```

A single role per seeded user is acceptable for MVP, but JWT claims must use a `roles` array.

### Refresh tokens

Fields should include at least:

```text
id
user_id
token_hash
expires_at
revoked_at
created_at
```

Use UUID identifiers where practical.

## 7. Implementation expectations

Use the existing Python/FastAPI stack created by Prompt 02.

Recommended libraries, unless the existing scaffold already uses alternatives:

```text
fastapi
uvicorn
sqlalchemy
psycopg[binary]
pydantic
python-jose[cryptography] or PyJWT
passlib[bcrypt] or bcrypt
python-multipart, if needed by OAuth2 form flows
pytest
httpx
```

Keep the implementation simple and maintainable:

- typed Pydantic request/response models,
- environment-driven configuration,
- service-local database session setup,
- deterministic startup initialization/migration for MVP,
- clear error responses,
- no plaintext passwords in logs or responses,
- no real secrets in source control.

For this project phase, a deterministic startup table-creation path is acceptable if it is documented as MVP/local development. If you add Alembic, keep it minimal and ensure Docker startup remains simple.

## 8. API behavior details

### Register

`POST /auth/register`

Accept at least:

```json
{
  "email": "new-user@example.com",
  "password": "example-password"
}
```

Default role for public registration:

```text
EV_USER
```

Do not allow public registration to self-assign `OPERATOR` or arbitrary `PROVIDER_ADMIN` privileges.

Provider-admin creation can remain seed-only in Prompt 03 unless you implement a protected operator-only endpoint. If you implement such an endpoint, keep it minimal and documented.

### Login

`POST /auth/login`

Accept JSON credentials. Supporting OAuth2 password form is optional.

On invalid credentials, return `401` without revealing whether email or password was wrong.

### Refresh

`POST /auth/refresh`

Accept refresh token and return a new access token if valid and not revoked/expired.

### Logout

`POST /auth/logout`

Accept refresh token and revoke it idempotently.

### Me

`GET /auth/me`

Requires `Authorization: Bearer <access_token>` and returns the current authenticated user claims/profile.

## 9. Documentation updates

Update the relevant documentation in English:

```text
services/auth-service/README.md
README.md
.env.example
```

Document:

- local demo users,
- local demo password variable,
- auth endpoints,
- gateway smoke-test commands,
- JWT/refresh-token behavior,
- Google OAuth local placeholder behavior,
- what is intentionally out of scope.

Do not include real secrets.

## 10. Tests and validation

Add auth-service tests where practical. At minimum, include tests or documented smoke checks for:

- health endpoint remains working,
- seed users can log in,
- invalid login fails,
- access token can call `/auth/me`,
- provider admin token contains provider scope,
- refresh token can issue new access token,
- logout revokes refresh token,
- public register creates `EV_USER`, not elevated roles.

Run all feasible checks from the repository root and record exact commands and results in the run report.

Required validation commands, adapting only if the repository environment requires it:

```bash
git diff --check
docker compose config
docker compose up -d --build
docker compose ps
curl -f http://localhost:8080/health
curl -f http://localhost:8080/api/auth/health
```

Then run auth smoke tests through the gateway. Include concrete `curl` examples in the run report. Do not print secret values.

After validation, stop containers if this is the established workflow:

```bash
docker compose down -v
```

## 11. AI logging requirements

Create/update:

```text
docs/ai/codex-runs/003-auth-service.md
docs/ai/prompt-log.md
```

The run report must include:

- status,
- exact invocation prompt,
- canonical task prompt path,
- files read,
- files changed,
- implementation summary,
- tests/checks run,
- command results,
- known warnings/limitations,
- explicit confirmation that non-auth services and business domains were not implemented.

Update `docs/ai/prompt-log.md` with run `003` as `completed`, `partial`, or `failed` according to actual result.

If this prompt file is newly added to the repository as part of the run, include it in files changed and keep it under:

```text
docs/ai/prompts/prompt_03_auth_service.md
```

## 12. Acceptance criteria

Prompt 03 is acceptable only if all criteria below are satisfied:

1. `auth-service` has real local persistence in `auth-postgres`.
2. Seed demo users are created idempotently.
3. Passwords are stored hashed, not plaintext.
4. Email/password login issues JWT access tokens and refresh tokens.
5. JWT claims include `sub`, `email`, `roles`, `provider_id`, `provider_code`, and `exp`.
6. Refresh tokens are stored hashed and can be revoked.
7. `GET /auth/me` works with a Bearer token.
8. Provider admin seeded users include correct provider scope.
9. Public registration creates only `EV_USER` users.
10. Google OAuth hook endpoints exist and fail safely when placeholders are used.
11. Existing gateway health checks continue to pass.
12. Docker Compose still builds and starts successfully.
13. Documentation is updated in English.
14. `.env.example` remains placeholder-only and no `.env` is committed.
15. No unrelated service logic, frontend business screens, provider adapters, catalog/status/reservation/analytics/billing implementation, or GitHub fallback project-management artifacts are added.
16. `docs/ai/codex-runs/003-auth-service.md` and `docs/ai/prompt-log.md` are updated.

## 13. Final response expected from Codex

Return a concise implementation report with:

```text
COMPLETED
```

or

```text
COMPLETED_WITH_WARNINGS
```

or

```text
FAILED
```

Then list:

- files created,
- files modified,
- validation commands and results,
- warnings/blockers,
- confirmation of non-goals preserved,
- recommended next prompt.
