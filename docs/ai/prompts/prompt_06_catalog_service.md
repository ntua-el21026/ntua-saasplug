# Prompt 06 - Catalog Service

## 1. Task

Implement **Prompt 06** for the NTUA ECE saasPlug project.

This run must implement only the `catalog-service` MVP baseline.

The goal is to turn the existing health-only `catalog-service` scaffold into the service that owns the aggregated normalized charging-point catalog, imports normalized points from the three provider services, and exposes gateway-facing catalog/search/map/detail endpoints.

Follow:

```text
AGENTS.md
docs/specs/SPECIFICATIONS.md
docs/ai/prompts/README.md
docs/ai/codex-runs/_template.md
```

Treat these files as canonical. Do not change accepted specifications unless explicitly instructed by the user in a later SPEC amendment.

Repository content, code, comments, README files, prompts, and AI logs must be in English.

---

## 2. Current project state assumptions

The previous prompts have already implemented:

- Docker Compose baseline and Nginx gateway.
- `auth-service` with JWT access tokens, roles, seeded demo users, and provider-admin scope claims.
- `provider-registry-service` with seeded providers and safe provider configuration metadata.
- `red-provider-service`, `green-provider-service`, and `blue-provider-service` with:
  - provider-specific external API mappings,
  - normalized internal DTOs,
  - provider-local persistence,
  - raw payload storage,
  - sync runs,
  - internal endpoints under `/internal/...`,
  - deterministic tests using fake provider responses.

Before implementing, inspect at least:

```text
AGENTS.md
docs/specs/SPECIFICATIONS.md
docs/ai/prompts/README.md
docs/ai/codex-runs/_template.md
docs/ai/prompt-log.md

docs/ai/codex-runs/005-provider-services.md

docker-compose.yml
deploy/nginx/default.conf
.env.example
README.md

services/catalog-service/
services/catalog-service/README.md
services/catalog-service/app/main.py
services/catalog-service/requirements.txt
services/catalog-service/Dockerfile

services/auth-service/app/security.py
services/auth-service/app/schemas.py

services/provider-registry-service/app/routes.py
services/provider-registry-service/app/schemas.py
services/provider-registry-service/README.md

services/red-provider-service/app/schemas.py
services/red-provider-service/app/routes.py
services/red-provider-service/README.md

services/green-provider-service/app/schemas.py
services/green-provider-service/app/routes.py
services/green-provider-service/README.md

services/blue-provider-service/app/schemas.py
services/blue-provider-service/app/routes.py
services/blue-provider-service/README.md

docs/assignment/providers/yaml/redPlug.yaml
docs/assignment/providers/yaml/greenPlug.yaml
docs/assignment/providers/yaml/bluePlug.yaml
```

Also inspect the current GitHub issue:

```text
#6 - Prompt 06 - Catalog service
```

Do not assume it is closed.

---

## 3. Scope

Implement only `catalog-service`.

### 3.1 Required `catalog-service` responsibilities

`catalog-service` must own:

- aggregated normalized catalog persistence in `catalog-postgres`;
- import/sync coordination with the three provider services through internal Docker-network service URLs;
- normalized catalog point rows across `redPlug`, `greenPlug`, and `bluePlug`;
- full upsert with change detection;
- stale/inactive handling for points missing from a provider import;
- cached/local point details;
- viewport/bounds-based map loading;
- search/filter/list endpoints;
- provider/date/data-freshness metadata;
- import run records;
- containerized tests;
- service README updates;
- root README status updates;
- AI run logs.

### 3.2 Explicit non-goals

Do **not** implement:

- status-service 5-minute status cache;
- reservation-service reservation truth;
- reservation events;
- RabbitMQ business consumers or publishers;
- analytics-service;
- billing-service;
- frontend screens;
- direct browser calls to provider services;
- provider services exposed through Nginx;
- direct calls from catalog-service to external provider APIs;
- cross-service database reads or writes;
- real secrets;
- new runtime services;
- Alembic migrations unless already established by prior prompts;
- fallback Markdown project-management artifacts.

---

## 4. Architecture constraints

### 4.1 Data ownership

`catalog-service` owns only its own database:

```text
catalog-service -> catalog-postgres
```

It must not read or write any other service database.

Allowed integration patterns:

```text
catalog-service -> red-provider-service HTTP internal endpoint
catalog-service -> green-provider-service HTTP internal endpoint
catalog-service -> blue-provider-service HTTP internal endpoint
catalog-service -> provider-registry-service HTTP internal endpoint or gateway/internal URL if already suitable
catalog-service -> auth-service-compatible JWT verification locally
```

Forbidden integration patterns:

```text
catalog-service -> red-provider-postgres
catalog-service -> green-provider-postgres
catalog-service -> blue-provider-postgres
catalog-service -> provider-registry-postgres
catalog-service -> external provider API URL
frontend -> provider service
frontend -> external provider API
```

### 4.2 Gateway route behavior

Nginx already routes:

```text
/api/catalog/* -> catalog-service
```

Because the Nginx `proxy_pass` strips `/api/catalog/`, implement service routes directly as:

```text
GET  /points
GET  /points/{provider_code}/{external_point_id}
POST /imports/providers/{provider_code}
POST /imports/all
GET  /imports/runs
GET  /freshness
```

Do not add provider-service routes to Nginx.

### 4.3 Provider service integration

Use the existing internal provider endpoints from Prompt 05:

```text
GET  /internal/provider
GET  /internal/points
POST /internal/sync
GET  /internal/points/{external_point_id}
GET  /internal/points/{external_point_id}/status
POST /internal/points/{external_point_id}/reservations
GET  /internal/sync-runs
```

For Prompt 06, catalog-service should use only:

```text
POST /internal/sync
GET  /internal/points
GET  /internal/points/{external_point_id}
GET  /internal/provider
```

Do not call provider status or reservation endpoints from catalog-service. Status is Prompt 07 scope. Reservation is Prompt 08 scope.

### 4.4 Provider service URLs

Add safe `.env.example` and `docker-compose.yml` defaults for internal provider-service URLs if missing:

```text
RED_PROVIDER_SERVICE_URL=http://red-provider-service:8000
GREEN_PROVIDER_SERVICE_URL=http://green-provider-service:8000
BLUE_PROVIDER_SERVICE_URL=http://blue-provider-service:8000
CATALOG_PROVIDER_HTTP_TIMEOUT_SECONDS=10
CATALOG_IMPORT_ON_STARTUP=false
```

`CATALOG_IMPORT_ON_STARTUP` may exist but must default to `false` to avoid surprising external provider calls during normal stack startup. If implemented, startup import must call provider services, not external provider APIs directly. Tests should not depend on live external APIs.

---

## 5. Data model requirements

Use SQLAlchemy, following the MVP startup table-creation style already used by previous services unless the repo has since introduced migrations.

Create catalog-owned tables/models equivalent to:

### 5.1 `catalog_points`

Fields should include at least:

```text
id
normalized_point_id
provider_code
external_point_id
display_name
location_name
address
latitude
longitude
coordinate_source
status
reservation_ends_at
price_per_kwh_eur
capacity
connector
is_active
is_stale
last_provider_seen_at
last_catalog_sync_at
raw_provider_payload
created_at
updated_at
```

Constraints:

- unique `(provider_code, external_point_id)`;
- unique `normalized_point_id`;
- `normalized_point_id` format must be:

```text
provider_code:external_point_id
```

Examples:

```text
redPlug:123
greenPlug:123
bluePlug:123
```

### 5.2 Coordinate handling

The provider YAMLs and Prompt 05 normalized DTOs may not contain latitude/longitude fields.

Do not falsely claim provider-provided coordinates when they do not exist.

Implement coordinate handling as follows:

1. `latitude` and `longitude` must be nullable.
2. `coordinate_source` must distinguish at least:
   - `provider`
   - `demo_synthetic`
   - `missing`
3. If provider DTOs do not contain coordinates, either:
   - store `latitude = null`, `longitude = null`, `coordinate_source = "missing"`, or
   - generate deterministic demo coordinates only if they are explicitly marked as `coordinate_source = "demo_synthetic"`.

For MVP usability, deterministic demo coordinates are acceptable if:
- they are stable for the same `(provider_code, external_point_id)`;
- they are located in a plausible Athens demo area;
- README documentation clearly says they are synthetic demo coordinates because provider APIs do not expose coordinates;
- API responses expose `coordinate_source`.

Do not hide this limitation.

### 5.3 `catalog_import_runs`

Fields should include at least:

```text
id
provider_code
status
triggered_by
started_at
completed_at
provider_sync_triggered
provider_fetched_count
catalog_upserted_count
catalog_changed_count
catalog_marked_stale_count
error_message
```

Supported statuses:

```text
running
completed
failed
partial
```

### 5.4 Optional `catalog_point_changes`

If practical, add a simple point-change table to support change detection debugging:

```text
id
provider_code
external_point_id
normalized_point_id
changed_fields
created_at
```

This is optional but recommended if it remains simple.

---

## 6. API requirements

### 6.1 Health/readiness

Keep existing endpoints:

```text
GET /health
GET /ready
```

### 6.2 List/search/map points

Implement:

```text
GET /points
```

Query parameters:

```text
minLat: float | optional
maxLat: float | optional
minLng: float | optional
maxLng: float | optional
providerCode: string | optional
status: string | optional
connector: string | optional
q: string | optional
includeStale: bool = false
limit: int = 100
offset: int = 0
```

Behavior:

- If bounds are provided, return only points with coordinates inside bounds.
- Coordinate-less points should not match viewport bounds unless no bounds are provided.
- Do not ever load all points for map use by default from the frontend. The endpoint must support viewport/bounds.
- Enforce sane `limit` bounds, for example max 500.
- By default return active and non-stale points only.
- `q` should search at least `display_name`, `location_name`, `address`, and `normalized_point_id`.

Response should include:

```text
items
total
limit
offset
bounds_applied
missing_coordinates_count
```

### 6.3 Point details

Implement:

```text
GET /points/{provider_code}/{external_point_id}
```

Return cached/local catalog details only. Do not call provider services live from this endpoint.

### 6.4 Provider import

Implement operator-only manual import endpoints:

```text
POST /imports/providers/{provider_code}
POST /imports/all
```

Behavior:

- Verify JWT access token using the same `JWT_SECRET` as auth-service.
- Only `OPERATOR` can trigger imports.
- For provider import:
  1. create an import run with `running`;
  2. call provider service `POST /internal/sync`;
  3. call provider service `GET /internal/points`;
  4. upsert returned normalized points into catalog tables;
  5. mark existing catalog rows for that provider as stale/inactive if missing from the latest import;
  6. record counts and completion status.
- For `/imports/all`, run red, green, and blue imports sequentially and return a per-provider summary. A `partial` status is acceptable if one provider fails.
- Use provider-service internal URLs, not gateway routes and not external provider APIs.
- Convert provider-service errors to clear internal API errors. Do not leak raw provider error bodies.

### 6.5 Import run listing

Implement:

```text
GET /imports/runs
```

Access rules:

- `OPERATOR`: can see all import runs.
- `PROVIDER_ADMIN`: can see only their provider's import runs.
- `EV_USER`: forbidden.

### 6.6 Freshness

Implement:

```text
GET /freshness
```

Return per-provider freshness information such as:

```text
provider_code
active_count
stale_count
last_successful_import_at
last_import_status
```

Access rules:

- `OPERATOR`: all providers.
- `PROVIDER_ADMIN`: own provider only.
- `EV_USER`: may see public non-sensitive freshness if useful, but provider-specific operational metadata can be restricted. Keep this simple and document it.

### 6.7 Authorization

Use auth-service-compatible JWT validation locally, as provider-registry-service already does.

Access rules:

| Endpoint | EV_USER | PROVIDER_ADMIN | OPERATOR |
|---|---:|---:|---:|
| `GET /points` | yes, all active non-stale points | yes, own provider or all public points; choose and document | yes |
| `GET /points/{provider_code}/{external_point_id}` | yes if active/non-stale | yes own provider, or public active/non-stale | yes |
| `POST /imports/providers/{provider_code}` | no | no | yes |
| `POST /imports/all` | no | no | yes |
| `GET /imports/runs` | no | own provider only | all |
| `GET /freshness` | simple public or authenticated, document exact behavior | own provider or public | all |

Keep the implementation simple and deterministic.

---

## 7. Normalization/import requirements

Catalog imports must map provider-service normalized DTOs into catalog-owned DTOs.

Provider-service normalized point DTO shape from Prompt 05 is expected to include:

```text
provider_code
external_point_id
normalized_point_id
status
reservation_ends_at
price_per_kwh_eur
capacity
connector
location_name
address
raw_payload
last_seen_at
```

Catalog-service must not depend on provider-specific raw field names when importing. It must consume provider-service normalized DTOs.

If a provider-service DTO lacks a field, use explicit fallback policies:

| Missing field | Catalog behavior |
|---|---|
| price | `price_per_kwh_eur = null`, display/API can indicate unavailable |
| status | `status = "unknown"` |
| connector | `connector = null` |
| capacity | `capacity = null` |
| location/address | nullable, searchable only when present |
| coordinates | nullable or deterministic demo synthetic with explicit source |

Allowed normalized statuses:

```text
available
charging
reserved
malfunction
offline
unknown
```

If another value appears, map it to `unknown` and retain the raw payload.

---

## 8. Tests

Add tests under:

```text
services/catalog-service/tests/
```

Tests must be deterministic and must not depend on live provider APIs.

Use one of these approaches:

- monkeypatch/fake the catalog provider-service HTTP client; or
- use local fake responses inside tests.

Required test coverage:

1. health endpoint still works;
2. operator can import one provider from fake provider-service responses;
3. import upserts points and does not duplicate on repeated import;
4. missing points from latest import are marked stale/inactive;
5. `GET /points` supports provider/status/search filters;
6. `GET /points` supports viewport/bounds filtering with coordinate-aware behavior;
7. `GET /points/{provider_code}/{external_point_id}` returns cached local details;
8. provider-admin cannot trigger imports;
9. provider-admin import-run listing is scoped to their provider;
10. EV user cannot access import runs;
11. `/imports/all` returns per-provider summary;
12. raw provider payloads are stored but no API key or secret values are exposed.

Minimum acceptable test command:

```bash
docker compose run --rm --no-deps catalog-service pytest -q
```

---

## 9. Documentation updates

Update at least:

```text
README.md
services/catalog-service/README.md
docs/ai/prompt-log.md
docs/ai/codex-runs/006-catalog-service.md
```

`services/catalog-service/README.md` must document:

- ownership boundaries;
- database tables;
- gateway-visible endpoints;
- internal provider-service import flow;
- JWT/role rules;
- viewport/bounds map behavior;
- coordinate limitation and `coordinate_source`;
- full upsert and stale/inactive behavior;
- validation/test commands;
- explicit non-goals.

Root `README.md` must mention Prompt 06 completion/status and next step.

---

## 10. Docker Compose and environment

Update `docker-compose.yml` only as needed for `catalog-service`, for example:

```text
RED_PROVIDER_SERVICE_URL
GREEN_PROVIDER_SERVICE_URL
BLUE_PROVIDER_SERVICE_URL
CATALOG_PROVIDER_HTTP_TIMEOUT_SECONDS
CATALOG_IMPORT_ON_STARTUP
JWT_SECRET
```

Do not expose provider services through the gateway.

Keep `.env.example` safe and placeholder-only.

Do not create `.env`.

---

## 11. Validation commands

Run and record results for at least:

```bash
git diff --check
docker compose config
docker compose run --rm --no-deps catalog-service pytest -q
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/api/catalog/health
```

Also perform a smoke test through the gateway for at least:

- operator-authenticated import using a token from `auth-service` login;
- `GET /api/catalog/points` with bounds or filters;
- `GET /api/catalog/freshness`;
- `GET /api/catalog/imports/runs`.

Use sanitized output. Do not print tokens.

Finally run:

```bash
docker compose down -v
docker compose ps -a
test ! -f .env
```

---

## 12. GitHub issue/project action

After all Prompt 06 acceptance criteria pass:

1. Inspect GitHub issue `#6`.
2. Add a completion comment referencing:

```text
docs/ai/codex-runs/006-catalog-service.md
```

3. Close issue `#6` as completed.
4. If possible, verify or update the GitHub Project item for issue `#6` to `Done`.

If GitHub issue/project mutations fail:

- report the failure clearly in the Codex final response;
- record the failure in `docs/ai/codex-runs/006-catalog-service.md`;
- do not create fallback Markdown project-management artifacts.

---

## 13. AI logging

Create or update:

```text
docs/ai/codex-runs/006-catalog-service.md
docs/ai/prompt-log.md
```

The run log must include:

- exact invocation prompt;
- canonical task prompt path and content summary;
- files read;
- files created/modified;
- commands run;
- test results;
- Docker/gateway smoke results;
- GitHub issue/project actions;
- limitations/warnings;
- final status.

Use:

```text
COMPLETED
```

only if all required implementation and validation steps pass.

---

## 14. Expected final response from Codex

The final Codex response must include:

- status: `COMPLETED`, `COMPLETED_WITH_WARNINGS`, or `FAILED`;
- concise implementation summary;
- files created;
- files modified;
- validation results;
- GitHub issue/project result for issue `#6`;
- warnings/limitations;
- next recommended action.

The next recommended action should be:

```text
Review the Prompt 06 diff, then proceed to Prompt 07 for status-service.
```
