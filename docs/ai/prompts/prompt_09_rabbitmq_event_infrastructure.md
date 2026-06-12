# Prompt 09 - RabbitMQ Event Infrastructure

## Purpose

Implement the shared RabbitMQ event infrastructure for saasPlug, without implementing analytics or billing business logic yet.

This prompt must connect the existing Docker Compose RabbitMQ baseline, the accepted event-envelope specification, and the reservation-service outbox created in Prompt 08. The result must be deterministic, testable, and ready for Prompt 10 (`analytics-service`) and Prompt 11 (`billing-service`).

## Canonical sources

Before making changes, read and follow:

1. `AGENTS.md`
2. `docs/specs/SPECIFICATIONS.md`
3. `docs/ai/prompts/README.md`
4. `docs/ai/codex-runs/_template.md`
5. `docs/ai/prompt-log.md`
6. `docs/ai/codex-runs/008-reservation-service.md`
7. `packages/README.md`
8. `docker-compose.yml`
9. `.env.example`
10. `services/reservation-service/README.md`
11. `services/reservation-service/app/models.py`
12. `services/reservation-service/app/routes.py`
13. `services/reservation-service/app/reservation_logic.py`
14. `services/analytics-service/README.md`
15. `services/billing-service/README.md`

If any mandatory file is missing, report it before proceeding unless this prompt explicitly asks you to create it.

## Scope

Implement only Prompt 09 scope:

- shared event-envelope contracts,
- RabbitMQ topology declaration,
- publisher helpers,
- consumer helper primitives for later services,
- simple DLQ topology,
- reservation outbox publishing from the already staged reservation events,
- idempotency guidance and reusable helper logic,
- tests,
- documentation,
- AI logs,
- GitHub issue #9 completion after validation.

## Explicit non-goals

Do not implement:

- analytics-service event consumption or aggregate logic,
- billing-service event consumption, charge creation, invoice logic, or payment logic,
- provider sync choreography beyond shared contracts/topology,
- frontend screens,
- new dashboards,
- scheduler service,
- orchestrator service,
- saga implementation,
- distributed transactions,
- Kubernetes,
- direct frontend actions through RabbitMQ,
- real provider credentials,
- real secrets,
- `.env`,
- fallback Markdown project-management artifacts.

RabbitMQ must still not be used for login, provider registration, map search, point details, live status lookup, or the synchronous reservation provider call.

## Required design constraints

### Exchange

Use the accepted topic exchange:

```text
saasplug.events
```

The exchange name must be configurable through an environment variable but default to `saasplug.events`.

Recommended variable:

```text
RABBITMQ_EVENT_EXCHANGE=saasplug.events
```

### Event envelope

All events must use the accepted common envelope:

```json
{
  "event_id": "uuid",
  "event_type": "reservation.succeeded",
  "event_version": 1,
  "occurred_at": "2026-06-10T15:20:00Z",
  "correlation_id": "uuid",
  "producer": "reservation-service",
  "payload": {}
}
```

Required fields:

- `event_id`
- `event_type`
- `event_version`
- `occurred_at`
- `correlation_id`
- `producer`
- `payload`

Use UTC ISO-8601 timestamps. Avoid naive datetimes.

### Routing keys

Define canonical routing-key constants for at least:

```text
provider.sync.requested
provider.points.snapshot_ready
catalog.points.imported
usage.search_performed
usage.point_viewed
status.point_checked
reservation.succeeded
reservation.failed
billing.charge_created
billing.invoice_issued
billing.invoice_paid
```

Use event type as the routing key unless there is a strong reason not to. If you choose a different routing-key mapping, document it clearly and keep it deterministic.

### Delivery semantics

Use at-least-once delivery.

Consumers must be designed to be idempotent. This prompt should provide reusable helper primitives and documentation for idempotent consumers, but must not implement analytics or billing consumers yet.

### DLQs

Declare simple dead-letter queues for the future consumers. Include at least:

```text
analytics.events.dlq
billing.reservations.dlq
catalog.provider_snapshots.dlq
```

Also define primary queues/bindings that later prompts can use. Suggested names:

```text
analytics.events
billing.reservations
catalog.provider_snapshots
```

Bind them to the topic exchange with deterministic routing patterns, for example:

```text
analytics.events <- usage.*, status.point_checked, reservation.*, catalog.points.imported, billing.invoice.*
billing.reservations <- reservation.succeeded, reservation.failed
catalog.provider_snapshots <- provider.points.snapshot_ready
```

Do not implement a DLQ UI.

## Shared package requirements

Create a shared Python package under:

```text
packages/events/
```

Recommended structure:

```text
packages/events/
  README.md
  pyproject.toml
  saasplug_events/
    __init__.py
    envelope.py
    routing.py
    topology.py
    publisher.py
    consumer.py
    idempotency.py
  tests/
    test_envelope.py
    test_routing.py
    test_topology.py
    test_publisher.py
```

You may adjust the structure if needed, but keep it simple and documented.

The package must include:

1. A Pydantic event-envelope model.
2. Event type/routing-key constants.
3. Exchange and queue topology definitions.
4. A publisher helper using RabbitMQ.
5. A consumer helper or base primitive that supports explicit acknowledgement/requeue/DLQ-friendly behavior.
6. Idempotency helper documentation or code that later services can reuse.
7. Tests that do not require a live RabbitMQ server unless also covered by a separate optional smoke command.

Prefer `pika` or `aio-pika` only if the repo does not already standardize another RabbitMQ client. Keep the dependency minimal and document the choice.

## Reservation-service integration

Prompt 08 already created staged outbox records in `reservation_event_outbox` with common envelope fields including `correlation_id`.

In this prompt, integrate `reservation-service` with the shared event package so that it can publish pending outbox events to RabbitMQ after the reservation result is already persisted.

Required behavior:

1. Do not publish to RabbitMQ before the synchronous provider reservation call returns.
2. Do not publish inside the provider-call critical path if that creates user-facing fragility.
3. Provide a deterministic outbox publishing function that:
   - selects pending outbox rows,
   - builds/validates event envelopes,
   - publishes to `saasplug.events`,
   - marks rows as `published` on success,
   - records failure metadata without losing the row if publishing fails.
4. Add missing outbox metadata fields if useful, such as:
   - `publish_attempts`,
   - `last_publish_error`,
   - `last_publish_attempt_at`.
5. Preserve existing Prompt 08 tests and add new tests for:
   - envelope construction from outbox rows,
   - successful outbox publish marks rows as published,
   - failed publish keeps rows pending/failed with error metadata,
   - no duplicate publish when row is already published.

Acceptable publishing trigger for the MVP:

- an internal/operator-gated endpoint such as:

```text
POST /events/outbox/publish-pending
GET  /events/outbox
```

or a local service function with tests plus a documented manual command/smoke path.

Do not add a background scheduler service. If you add a lightweight in-service startup or loop, keep it disabled by default and explain it. Prefer an explicit endpoint/function for this prompt.

## RabbitMQ topology setup

Implement a reusable topology declaration function that declares:

- the `saasplug.events` topic exchange,
- the DLQ exchange or direct DLQ queues, depending on your design,
- the primary queues,
- the queue bindings,
- dead-letter routing.

Add a safe way to run topology declaration, such as:

- package-level function tested with a fake channel,
- reservation-service startup declaration if RabbitMQ is available,
- or an internal endpoint/command documented for local development.

If topology declaration at startup would make service health depend too strongly on RabbitMQ, keep it non-fatal and document the behavior.

## Existing services interaction

Do not modify analytics-service or billing-service beyond README references if needed. They remain implementation targets for later prompts.

Do not modify catalog-service or status-service to publish business events in this prompt unless needed for a small shared helper import or documentation. Their full analytics event emission can be handled in Prompt 10 if necessary.

Do not expose provider services through Nginx.

## Environment and Compose

Update `.env.example` with safe placeholders/defaults as needed, for example:

```text
RABBITMQ_EVENT_EXCHANGE=saasplug.events
RABBITMQ_PUBLISH_TIMEOUT_SECONDS=5
RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP=false
RESERVATION_OUTBOX_PUBLISH_BATCH_SIZE=50
```

Update `docker-compose.yml` only as needed to pass these safe environment variables to relevant services.

Do not add new runtime containers.

## Documentation requirements

Update or create:

- `packages/events/README.md`
- `packages/README.md` if needed
- `services/reservation-service/README.md`
- root `README.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/009-rabbitmq-event-infrastructure.md`

The documentation must explain:

- exchange name,
- event envelope,
- routing keys,
- queue/DLQ topology,
- at-least-once delivery,
- idempotency expectations,
- reservation outbox publishing flow,
- what is intentionally left to Prompt 10 and Prompt 11.

## Testing and validation

At minimum, run:

```bash
git diff --check
docker compose config
```

Run package tests, for example:

```bash
python -m pytest packages/events/tests -q
```

If local Python/package paths make that unreliable, run the tests in an appropriate Docker context and document exactly how.

Run reservation-service tests after integration, for example:

```bash
docker compose run --build --rm --no-deps reservation-service pytest -q
```

Run full stack validation:

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/api/reservations/health
```

Add a RabbitMQ smoke check if practical. Acceptable smoke checks include:

- declaring topology against the live RabbitMQ container,
- publishing a deterministic test event to `saasplug.events`,
- publishing a pending reservation outbox row through the reservation-service endpoint using a fake/test-created row if practical.

Do not require live external provider APIs for Prompt 09 acceptance.

Always clean up after validation:

```bash
docker compose down -v
docker compose ps -a
test ! -f .env
```

## GitHub issue/project management

After all Prompt 09 acceptance criteria pass:

1. Inspect GitHub issue `#9`.
2. Add a completion comment referencing:

```text
docs/ai/codex-runs/009-rabbitmq-event-infrastructure.md
```

3. Close issue `#9` as completed.
4. If possible, verify or update the GitHub Project item status to `Done`.

If GitHub issue/project mutation fails:

- report the failure clearly in the final response,
- record the failure in `docs/ai/codex-runs/009-rabbitmq-event-infrastructure.md`,
- do not create fallback Markdown project-management artifacts.

## AI run report

Create/update:

```text
docs/ai/codex-runs/009-rabbitmq-event-infrastructure.md
```

Use:

```text
docs/ai/codex-runs/_template.md
```

Record:

- exact invocation prompt,
- canonical task prompt path,
- canonical sources read,
- files created/modified,
- tests/checks run,
- any failed command and fix,
- GitHub issue/project actions,
- limitations and deferred work.

Update:

```text
docs/ai/prompt-log.md
```

Add run `009` with status `completed` or `completed_with_warnings` depending on validation.

## Acceptance criteria

Prompt 09 is acceptable only if:

1. Common event envelope and routing-key contracts exist in `packages/events`.
2. RabbitMQ topology declaration exists and is tested with fake channel/unit tests or a live smoke check.
3. DLQ topology definitions exist and are documented.
4. Reservation-service can publish pending Prompt 08 outbox events or has a tested publisher function/endpoint.
5. Published reservation event envelopes contain all required SPEC-5 fields.
6. Outbox rows are not lost on publish failure.
7. Already published rows are not republished.
8. Analytics and billing business logic are not implemented.
9. No new orchestrator/scheduler service is created.
10. No frontend screens are added.
11. `.env` is not created.
12. Tests and validation commands pass or any warning is clearly environment-limited and non-blocking.
13. `docs/ai/prompt-log.md` and `docs/ai/codex-runs/009-rabbitmq-event-infrastructure.md` are updated.
14. GitHub issue `#9` is closed as completed if GitHub mutations succeed.

## Final response requirements

In the final Codex response, include:

- final status,
- files created/modified,
- tests/checks run and results,
- GitHub issue/project actions,
- warnings/limitations,
- exact next recommended action.

The next recommended action should be:

```text
Review the Prompt 09 diff, then proceed to Prompt 10 for analytics-service.
```
