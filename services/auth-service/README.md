# auth-service

## Responsibility

`auth-service` owns authentication and authorization: email/password login,
Google OAuth login, JWT access tokens, refresh tokens, role checks, and
provider-admin scoping.

## Owned database

`auth-postgres`

## Exposure

Public through `nginx-gateway` under `/api/auth/...`.

## Belongs here

- FastAPI implementation for authentication flows.
- User, credential, refresh-token, and authorization persistence owned by this
  service.
- Auth-specific tests and migrations.

## Must not be placed here

- Frontend login screens.
- Provider catalog, status, reservation, analytics, or billing logic.
- Plaintext passwords or real secrets.

## Future implementation notes

Seed demo users must include the canonical operator, EV user, and provider
admin emails from `AGENTS.md`. Passwords must never be stored in plaintext.

Application logic is not implemented in this scaffold.

## Runtime baseline

Prompt 02 adds a minimal FastAPI container scaffold with:

```text
GET /
GET /health
GET /ready
```

These endpoints return static infrastructure metadata only. They do not issue
JWTs, handle OAuth, validate credentials, connect to `auth-postgres`, or
implement user flows.

Gateway health smoke test:

```bash
curl http://localhost:8080/api/auth/health
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
