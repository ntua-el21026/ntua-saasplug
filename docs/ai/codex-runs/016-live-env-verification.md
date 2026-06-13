# Codex Run 016 - Live environment verification

Date: 2026-06-13

Canonical prompt: `docs/ai/prompts/prompt_16_live_env_verification.md`

Phase: B only

## Result

`PASS_WITH_WARNINGS`

Phase B was executed without starting Phase C or Phase D. Source code was
modified only for the minimal provider Bearer-auth fix and its narrow tests.
Environment files, provider credentials, migrations, deployment settings, and
broad test infrastructure were not modified.

The initial Phase B attempts failed because the local prompt/OpenAPI assumption
used a plain `authorization: <api-key>` header. Manual official Postman
verification showed that the live provider APIs require
`Authorization: Bearer <apiKey>`. A minimal provider-client fix was implemented,
and the final continuation rerun passed all required read-only provider,
Docker/gateway, authenticated smoke, and non-interactive Google OAuth checks.

## Scope controls

- `.env` was treated as sensitive local input only.
- `.env` was not printed, modified, copied, committed, or exposed.
- Provider API keys, Google secrets, passwords, JWT secrets, and access tokens
  were not printed.
- `openapi.json` was used as local verification input and remains untracked.
- Live reservation mutation checks were skipped because
  `RUN_LIVE_RESERVATION_SMOKE=true` was not set.
- Phase C and Phase D issues were not changed.

## Required reads

Read or inspected:

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/015-finalization-project-audit.md`
- `.env.example`
- `docker-compose.yml`
- `openapi.json`
- `docs/ai/prompts/prompt_16_live_env_verification.md`
- provider adapter/config files under:
  - `services/red-provider-service/`
  - `services/green-provider-service/`
  - `services/blue-provider-service/`

## Provider contract comparison and auth finding

The route/path implementation matches the provider contract in the local
OpenAPI file for the checked adapter behavior. The authentication behavior in
the local prompt/OpenAPI assumption was superseded by manual official Postman
verification and live provider behavior:

| Provider | Contract item | Implementation result |
|---|---|---|
| all | `Authorization: Bearer <apiKey>` header | Pass after minimal provider-client fix |
| redPlug | `GET /redPlug/api/points` | Pass via configured base URL plus `/points` |
| redPlug | `GET /redPlug/api/point/{pointid}` | Pass via `/point/{pointid}` |
| redPlug | `POST /redPlug/api/reserve/{pointid}` | Pass via default reservation path |
| redPlug | `POST /redPlug/api/reserve/{pointid}/{minutes}` | Pass via duration path strategy |
| greenPlug | `GET /greenPlug/api/chargingPoints` | Pass via `/chargingPoints` |
| greenPlug | `GET /greenPlug/api/chargingPoints/{pointid}` | Pass via `/chargingPoints/{pointid}` |
| greenPlug | `POST /greenPlug/api/chargingPoints/{pointid}/reservations` | Pass |
| greenPlug | Reservation body `{ "duration": minutes }` | Pass |
| bluePlug | `GET /bluePlug/api/locations` | Pass via `/locations` |
| bluePlug | `GET /bluePlug/api/location/{pointid}/status` | Pass |
| bluePlug | `POST /bluePlug/api/location/{pointid}/hold` | Pass |
| bluePlug | Reservation `minutes` query parameter | Pass |

The OpenAPI file defines provider paths with `/redPlug/api`,
`/greenPlug/api`, and `/bluePlug/api`. The repository provider configuration
uses live base URLs ending in those provider API prefixes and adapter paths
relative to those bases, which is consistent with the implementation model.

## Environment verification

Latest redacted structural validation result: `PASS`.

| Item | Result |
|---|---|
| `.env` presence | Present |
| `JWT_SECRET` | Set, non-placeholder, redacted |
| `DEMO_USER_PASSWORD` | Set, non-placeholder, redacted |
| `GOOGLE_CLIENT_ID` | Set, non-placeholder, redacted |
| `GOOGLE_CLIENT_SECRET` | Set, non-placeholder, redacted |
| `GOOGLE_REDIRECT_URI` | Matches local gateway callback |
| `RED_PROVIDER_API_KEY` | Set, non-placeholder, redacted |
| `GREEN_PROVIDER_API_KEY` | Set, non-placeholder, redacted |
| `BLUE_PROVIDER_API_KEY` | Set, non-placeholder, redacted |
| `PUBLIC_BASE_URL` | Coherent with `http://localhost:8080` gateway use |
| RabbitMQ URL credentials | Coherent with RabbitMQ default user/password variables |
| PostgreSQL URL passwords | Coherent with configured PostgreSQL password |
| Provider base URLs | Point to the expected live provider host and provider API paths |

## Live provider verification

Safe read-only checks were attempted directly against the live provider APIs
using the local `.env` provider base URLs and `Authorization: Bearer <apiKey>`.

| Provider | List check | JSON response | Records | Detail/status check |
|---|---:|---|---:|---|
| redPlug | HTTP 200 | Yes | 459 | HTTP 200 detail, JSON object |
| greenPlug | HTTP 200 | Yes | 509 | HTTP 200 detail, JSON object |
| bluePlug | HTTP 200 | Yes | 486 | HTTP 200 status/detail, JSON object |

Live reservation smoke was skipped by safety policy because
`RUN_LIVE_RESERVATION_SMOKE=true` was not set.

## Continuation reruns - Postman/Newman provider verification and auth fix

The continuation rerun located the official local Postman collection files:

| Collection | Tracked | Variables | Requests |
|---|---|---|---|
| `docs/assignment/providers/postman_collections/redPlug.postman_collection.json` | Yes | `baseUrl`, `apiKey` | List points, get point details, reserve point, reserve point with duration |
| `docs/assignment/providers/postman_collections/greenPlug.postman_collection.json` | Yes | `baseUrl`, `apiKey` | List charging points, get charging point, create reservation |
| `docs/assignment/providers/postman_collections/bluePlug.postman_collection.json` | Yes | `baseUrl`, `apiKey` | List locations, get location status, hold charger |

The official collections declare collection-level Bearer authentication. An
intermediate continuation used temporary read-only Newman wrapper collections
under `/tmp` to test the earlier plain-header assumption and confirmed it still
returned HTTP 401. The wrappers contained no secrets and were removed after the
run. No generated Newman environment files were created.

Newman was available through `npx --yes newman` and reported version `6.2.2`.
Only read-only list requests and conditional detail/status requests were used.
No reservation or mutation requests were run.

The final continuation implemented the minimal provider auth fix:

- added `PROVIDER_AUTH_SCHEME`, defaulting to `Bearer`;
- propagated the setting to redPlug, greenPlug, and bluePlug provider-service
  containers through Docker Compose;
- sent provider credentials as `Authorization: Bearer <apiKey>`;
- documented the placeholder/default in `.env.example`;
- added narrow assertions in existing provider-service HTTP-client tests.

The final live read-only fallback checks captured exact status/count/key-shape
results without printing response bodies:

| Provider | Tooling | List status | JSON | Records | First item keys | Detail/status |
|---|---|---:|---|---:|---|---|
| redPlug | Bearer-auth safe fallback | 200 | Yes | 459 | `address`, `cap`, `connector`, `lat`, `locationName`, `long`, `pointid`, `providerName`, `reservationendtime`, `status` | HTTP 200 |
| greenPlug | Bearer-auth safe fallback | 200 | Yes | 509 | `address`, `cap`, `connector`, `coords`, `id`, `kwhRateEur`, `locationName`, `providerName`, `reservedUntil`, `state` | HTTP 200 |
| bluePlug | Bearer-auth safe fallback | 200 | Yes | 486 | `address`, `cap`, `chargerId`, `connector`, `currentStatus`, `geo`, `locationName`, `pricePerKwh`, `providerName`, `reservationEnd` | HTTP 200 |

## Docker and app verification

Commands/checks run:

| Check | Result | Notes |
|---|---|---|
| `git status --short` | Pass | Existing Phase A documentation changes and local untracked verification inputs were visible |
| `git diff --check` | Pass | No whitespace errors |
| Red provider-service tests | Pass | 8 tests passed |
| Green provider-service tests | Pass | 8 tests passed |
| Blue provider-service tests | Pass | 8 tests passed |
| `docker compose config --quiet` | Pass | Used quiet mode to validate configuration without printing interpolated secrets |
| `docker compose up -d --build` | Pass | Stack built and started |
| `docker compose ps` | Pass | Frontend, gateway, RabbitMQ, services, and PostgreSQL containers were healthy |
| Gateway health routes | Pass | Gateway and all public service health endpoints returned HTTP 200 |
| EV authenticated smoke | Pass | Login, `/api/auth/auth/me`, and a read-only EV flow succeeded through the gateway |
| Provider-admin authenticated smoke | Pass | Login, `/api/auth/auth/me`, and a provider-admin read flow succeeded through the gateway |
| Operator authenticated smoke | Pass | Login, `/api/auth/auth/me`, and an operator read flow succeeded through the gateway |
| `docker compose down -v` | Pass | Containers, network, and volumes from this verification run were removed |
| `docker compose ps -a` | Pass | No Compose containers remained after cleanup |

## Google OAuth verification

Non-interactive Google OAuth configuration checks passed:

- `/api/auth/auth/google/login` reported OAuth as configured.
- A Google authorization URL was generated.
- The authorization URL host was `accounts.google.com`.
- The encoded redirect URI matched
  `http://localhost:8080/api/auth/auth/google/callback`.
- The client ID and OAuth scope parameters were present in the generated URL.

Full browser OAuth callback completion was not verified because the prompt only
requested non-interactive verification and no interactive OAuth browser login
was performed.

## GitHub issue/project updates

GitHub CLI project operations were available.

- Found Phase B issue `#16`.
- Moved the Phase B project item in Project #2,
  `saasPlug Finalization and Hardening`, to `Done`.
- Closed issue `#16` after Phase B passed with accepted warnings.
- Did not modify Phase C or Phase D issues.

## Files changed

Created:

- `docs/ai/codex-runs/016-live-env-verification.md`

Updated:

- `.env.example`
- `docker-compose.yml`
- `docs/ai/prompt-log.md`
- `docs/final-verification.md`
- `docs/submission-checklist.md`
- `services/red-provider-service/app/client.py`
- `services/red-provider-service/app/config.py`
- `services/red-provider-service/tests/test_provider_service_api.py`
- `services/green-provider-service/app/client.py`
- `services/green-provider-service/app/config.py`
- `services/green-provider-service/tests/test_provider_service_api.py`
- `services/blue-provider-service/app/client.py`
- `services/blue-provider-service/app/config.py`
- `services/blue-provider-service/tests/test_provider_service_api.py`

Used but not committed or moved:

- `openapi.json`
- `.env`

## Blockers

None.

## Warnings

- `openapi.json` is a local untracked verification input.
- Full interactive Google OAuth login was not performed.
- Live reservation mutation smoke was intentionally skipped because the safety
  flag was not enabled.
- The original Phase B prompt/OpenAPI assumption said plain
  `authorization: <api-key>`, but official Postman collections and live
  provider behavior require `Authorization: Bearer <apiKey>`.
