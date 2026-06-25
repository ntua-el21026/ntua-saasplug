# Codex Run 064 - README Audit and Update

## Invocation Prompt

```text
The user provided an attached pasted-text request titled:
"Final README Audit and Correction - saasPlug".

Task type:
FINAL README AUDIT, UPDATE, AND CREATION
```

Full invocation source:
`/home/peppasmich/.codex/attachments/2af588a4-77cb-4787-a247-c12406e75d97/pasted-text.txt`

## Goal

Audit existing repository README files, correct stale or verbose documentation,
and add missing README coverage where needed, using the current codebase as the
only source of truth.

## Non-Goals

- No application code changes.
- No business logic, API, or test changes.
- No stack startup.
- No external provider API calls.
- No `.env` content inspection or printing.
- No generated reports committed.

## README Files Found

Project README files found outside generated/cache directories:

- `README.md`
- `apps/README.md`
- `apps/frontend/README.md`
- `deploy/README.md`
- `deploy/nginx/README.md`
- `docs/README.md`
- `docs/ai/README.md`
- `docs/ai/codex-runs/README.md`
- `docs/ai/prompts/README.md`
- `docs/ai/prompts_chatgpt/prompts/README.md`
- `docs/assignment/README.md`
- `docs/assignment/plantUML_diagrams/README.md`
- `docs/assignment/providers/README.md`
- `docs/diagrams/README.md`
- `docs/diagrams/final/README.md`
- `docs/diagrams/intermediate/README.md`
- `docs/postman/README.md`
- `docs/postman/newman/README.md`
- `docs/specs/README.md`
- `packages/README.md`
- `packages/event-contracts/README.md`
- `packages/events/README.md`
- `packages/provider-normalization/README.md`
- `packages/shared-contracts/README.md`
- `scripts/README.md`
- `services/README.md`
- all eleven `services/*-service/README.md`
- `tests/README.md`

Generated/cache READMEs under `node_modules` and `.pytest_cache` were ignored.

## README Files Updated

- `README.md`
- `apps/frontend/README.md`
- `services/README.md`
- `services/auth-service/README.md`
- `services/provider-registry-service/README.md`
- `services/red-provider-service/README.md`
- `services/green-provider-service/README.md`
- `services/blue-provider-service/README.md`
- `services/catalog-service/README.md`
- `services/status-service/README.md`
- `services/reservation-service/README.md`
- `services/analytics-service/README.md`
- `services/billing-service/README.md`
- `services/scheduler-service/README.md`
- `docs/README.md`
- `docs/diagrams/README.md`
- `docs/postman/README.md`
- `packages/events/README.md`
- `scripts/README.md`

## README Files Created

- `scripts/postman/README.md`

## README Files Intentionally Left Unchanged

- `apps/README.md`
- `deploy/README.md`
- `deploy/nginx/README.md`
- `docs/ai/README.md`
- `docs/ai/codex-runs/README.md`
- `docs/ai/prompts/README.md`
- `docs/ai/prompts_chatgpt/prompts/README.md`
- `docs/assignment/README.md`
- `docs/assignment/plantUML_diagrams/README.md`
- `docs/assignment/providers/README.md`
- `docs/diagrams/final/README.md`
- `docs/diagrams/intermediate/README.md`
- `docs/postman/newman/README.md`
- `docs/specs/README.md`
- `packages/README.md`
- `packages/event-contracts/README.md`
- `packages/provider-normalization/README.md`
- `packages/shared-contracts/README.md`
- `tests/README.md`

These were already concise enough for their folders or were outside the
required correction scope after inspection.

## Main Stale Claims Corrected

- Root README was shortened and updated to avoid old verification totals and
  long architecture prose.
- Frontend README now states that Docker serves a static Vite build through
  Nginx on internal port `5173`.
- Frontend catalog search is documented as viewport-derived radius search with
  `centerLat`, `centerLng`, and `radiusKm`.
- Service READMEs now use implemented Compose service names, route groups,
  database tables, event roles, and test commands.
- Provider adapter READMEs explicitly state that red/green/blue provider
  services do not publish or consume RabbitMQ events.
- Reservation and billing READMEs document outbox-backed event publishing
  instead of direct synchronous request publishing.
- Scripts README no longer claims there are no scripts.
- Added missing `scripts/postman/README.md`.
- Postman README was shortened and aligned with existing runner scripts.
- `packages/events/README.md` now explicitly distinguishes declared provider
  snapshot topology from currently implemented producers.

## Validation Commands Run

```text
find . -name README.md | sort
```

Result: completed; generated/cache README files were identified and ignored.

```text
python3 - <<'PY'
from pathlib import Path
required = [...]
missing = [p for p in required if not Path(p).is_file()]
...
PY
```

Result: passed. All required README files are present.

```text
grep -RIn --include='README.md' \
  -e 'smartPlug' \
  -e 'saasCharge' \
  -e 'Vite dev server' \
  -e 'provider.points.snapshot_ready' \
  -e 'Identity Service' \
  --exclude-dir=node_modules \
  --exclude-dir=.pytest_cache \
  . || true
```

Result: retained only intentional `packages/events/README.md` references to
`provider.points.snapshot_ready`, which is a declared topology event and is now
documented as not currently produced by provider adapter services.

```text
docker compose config --quiet
```

Result: passed.

```text
PYTHONPATH=packages/events python -m pytest packages/events/tests -q
```

Result: passed, 10 tests. Python 3.14 emitted the existing Pydantic V1
compatibility warning from a local dependency.

```text
git diff --check
```

Result: passed.

## Limitations

- No Markdown link checker is configured in the repository, and no new global
  tooling was installed. Important README paths were checked manually while
  editing.
- The full Docker stack, frontend tests, backend service tests, and Postman
  suites were not run because this task changed documentation only.

## Status

COMPLETED
