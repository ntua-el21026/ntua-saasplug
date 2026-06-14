import csv
import io
import json
from datetime import UTC, datetime
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.main import app
from app.models import ExportJob, UsageEvent
from app.rabbitmq_consumer import drain_analytics_queue
from saasplug_events.envelope import EventEnvelope


def access_token(roles: list[str], email: str, provider_code: str | None = None) -> str:
    return jwt.encode(
        {
            "sub": f"user-{email}",
            "email": email,
            "roles": roles,
            "provider_id": provider_code,
            "provider_code": provider_code,
        },
        "analytics-test-secret",
        algorithm="HS256",
    )


def auth_headers(roles: list[str], email: str, provider_code: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token(roles, email, provider_code)}"}


def operator_headers() -> dict[str, str]:
    return auth_headers(["OPERATOR"], "operator@saasplug.local")


def ev_headers() -> dict[str, str]:
    return auth_headers(["EV_USER"], "evuser@saasplug.local")


def red_admin_headers() -> dict[str, str]:
    return auth_headers(["PROVIDER_ADMIN"], "red-admin@saasplug.local", "redPlug")


def envelope(
    event_type: str = "usage.point_viewed",
    provider_code: str = "redPlug",
    external_point_id: str = "101",
    payload: dict | None = None,
    occurred_at: datetime | None = None,
) -> EventEnvelope:
    base_payload = {
        "provider_code": provider_code,
        "external_point_id": external_point_id,
        "normalized_point_id": f"{provider_code}:{external_point_id}",
        "point_name": f"{provider_code} point {external_point_id}",
        "user_id": "user-1",
    }
    if payload:
        base_payload.update(payload)
    return EventEnvelope(
        event_id=uuid4(),
        event_type=event_type,
        event_version=1,
        occurred_at=occurred_at or datetime(2026, 6, 12, 10, 15, tzinfo=UTC),
        correlation_id=uuid4(),
        producer="analytics-test",
        payload=base_payload,
    )


def event_json(event: EventEnvelope) -> dict:
    return json.loads(event.model_dump_json())


@pytest.fixture()
def test_context(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'analytics-test.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SERVICE_NAME", "analytics-service")
    monkeypatch.setenv("JWT_SECRET", "analytics-test-secret")
    monkeypatch.setenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
    monkeypatch.setenv("RABBITMQ_EVENT_EXCHANGE", "saasplug.events")
    monkeypatch.setenv("ANALYTICS_RABBITMQ_CONSUME_BATCH_SIZE", "50")
    monkeypatch.setenv("ANALYTICS_RABBITMQ_CONSUME_TIMEOUT_SECONDS", "2")
    monkeypatch.setenv("ANALYTICS_RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP", "false")
    monkeypatch.setenv("SCHEDULER_INTERNAL_TOKEN", "scheduler-test-token")
    get_settings.cache_clear()
    reset_database_for_tests(database_url)
    with TestClient(app) as test_client:
        yield test_client
    get_settings.cache_clear()


def ingest(client: TestClient, events: list[EventEnvelope] | EventEnvelope):
    if isinstance(events, list):
        body = [event_json(event) for event in events]
    else:
        body = event_json(events)
    return client.post("/events/ingest", json=body, headers=operator_headers())


def refresh(client: TestClient):
    return client.post("/aggregates/refresh", headers=operator_headers())


def scheduler_headers() -> dict[str, str]:
    return {"X-Scheduler-Token": "scheduler-test-token", "X-Job-Run-Id": "scheduler-run-1"}


def seed_analytics_events(client: TestClient) -> None:
    events = [
        envelope("usage.search_performed", payload={"search_term": "fast charger"}),
        envelope("usage.point_viewed"),
        envelope("status.point_checked", payload={"status": "available"}),
        envelope(
            "reservation.succeeded",
            payload={"reservation_id": "reservation-1", "status": "succeeded"},
        ),
        envelope(
            "reservation.failed",
            provider_code="greenPlug",
            external_point_id="201",
            payload={
                "reservation_id": "reservation-2",
                "status": "failed",
                "error_type": "provider_http_error",
            },
        ),
        envelope(
            "catalog.points.imported",
            payload={
                "provider_code": "redPlug",
                "active_count": 12,
                "stale_count": 2,
                "imported_count": 14,
                "status": "completed",
            },
        ),
    ]
    response = ingest(client, events)
    assert response.status_code == 200
    assert response.json()["created_count"] == len(events)
    assert refresh(client).status_code == 200


def test_health_endpoint_still_works(test_context) -> None:
    response = test_context.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_scheduler_internal_refresh_requires_scheduler_token(test_context) -> None:
    response = test_context.post("/internal/jobs/aggregates/refresh")

    assert response.status_code == 401


def test_scheduler_internal_refresh_reuses_analytics_aggregate_logic(test_context) -> None:
    response = test_context.post("/internal/jobs/aggregates/refresh", headers=scheduler_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["usage_event_count"] == 0
    assert payload["operator_daily_rows"] == 0


def test_scheduler_internal_freshness_is_token_protected(test_context) -> None:
    missing = test_context.get("/internal/jobs/freshness")
    missing_run_id = test_context.get("/internal/jobs/freshness", headers={"X-Scheduler-Token": "scheduler-test-token"})
    allowed = test_context.get("/internal/jobs/freshness", headers=scheduler_headers())

    assert missing.status_code == 401
    assert missing_run_id.status_code == 400
    assert allowed.status_code == 200
    assert allowed.json()["analytics_delay_notice"] == "no_events_ingested"


def test_operator_can_ingest_canonical_event_envelope(test_context) -> None:
    event = envelope("usage.point_viewed")

    response = ingest(test_context, event)

    assert response.status_code == 200
    assert response.json()["created_count"] == 1
    db = get_session_factory()()
    try:
        stored_event = db.query(UsageEvent).one()
        assert stored_event.event_id == str(event.event_id)
        assert stored_event.provider_code == "redPlug"
        assert stored_event.internal_point_id == "redPlug:101"
    finally:
        db.close()


def test_duplicate_event_id_is_idempotent(test_context) -> None:
    event = envelope("usage.point_viewed")
    assert ingest(test_context, event).json()["created_count"] == 1

    response = ingest(test_context, event)

    assert response.status_code == 200
    assert response.json()["duplicate_count"] == 1
    db = get_session_factory()()
    try:
        assert db.query(UsageEvent).count() == 1
    finally:
        db.close()


def test_unsupported_event_type_is_deterministic(test_context) -> None:
    event = envelope("provider.sync.requested")

    response = ingest(test_context, event)

    assert response.status_code == 200
    assert response.json()["unsupported_count"] == 1
    db = get_session_factory()()
    try:
        assert db.query(UsageEvent).count() == 0
    finally:
        db.close()


def test_aggregate_refresh_computes_provider_totals_and_reservation_metrics(test_context) -> None:
    seed_analytics_events(test_context)

    response = test_context.get("/provider/summary?providerCode=redPlug", headers=operator_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider_code"] == "redPlug"
    assert payload["total_searches"] == 1
    assert payload["total_point_views"] == 1
    assert payload["total_status_checks"] == 1
    assert payload["successful_reservations"] == 1
    assert payload["failed_reservations"] == 0
    assert payload["reservation_conversion_rate"] == 1.0


def test_status_checked_events_update_status_distribution(test_context) -> None:
    seed_analytics_events(test_context)

    response = test_context.get("/provider/status-distribution?providerCode=redPlug", headers=operator_headers())

    assert response.status_code == 200
    assert response.json()["status_distribution"] == {"available": 1}


def test_provider_admin_can_access_only_own_provider_analytics(test_context) -> None:
    seed_analytics_events(test_context)

    own_response = test_context.get("/provider/summary", headers=red_admin_headers())
    other_response = test_context.get("/provider/summary?providerCode=greenPlug", headers=red_admin_headers())

    assert own_response.status_code == 200
    assert own_response.json()["provider_code"] == "redPlug"
    assert other_response.status_code == 403


def test_provider_admin_cannot_export_another_provider(test_context) -> None:
    seed_analytics_events(test_context)

    response = test_context.get("/exports/usage.csv?providerCode=greenPlug", headers=red_admin_headers())

    assert response.status_code == 403


def test_ev_user_cannot_access_provider_or_operator_analytics(test_context) -> None:
    provider_response = test_context.get("/provider/summary", headers=ev_headers())
    operator_response = test_context.get("/operator/summary", headers=ev_headers())

    assert provider_response.status_code == 403
    assert operator_response.status_code == 403


def test_operator_can_access_global_operator_analytics(test_context) -> None:
    seed_analytics_events(test_context)

    response = test_context.get("/operator/summary", headers=operator_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_searches"] == 1
    assert payload["total_point_views"] == 1
    assert payload["successful_reservations"] == 1
    assert payload["failed_reservations"] == 1
    assert payload["total_providers_seen"] == 2


def test_csv_export_returns_required_columns_and_records_export_job(test_context) -> None:
    seed_analytics_events(test_context)

    response = test_context.get("/exports/usage.csv?providerCode=redPlug", headers=operator_headers())

    assert response.status_code == 200
    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert rows
    assert {
        "occurred_at",
        "event_type",
        "provider_code",
        "internal_point_id",
        "external_point_id",
        "point_name",
        "user_id",
        "reservation_id",
        "status",
        "amount",
        "currency",
        "details",
    }.issubset(rows[0].keys())
    db = get_session_factory()()
    try:
        export_job = db.query(ExportJob).one()
        assert export_job.actor_email == "operator@saasplug.local"
        assert export_job.provider_code == "redPlug"
        assert export_job.row_count == len(rows)
    finally:
        db.close()


class FakeMethod:
    def __init__(self, delivery_tag: int) -> None:
        self.delivery_tag = delivery_tag


class FakeChannel:
    def __init__(self, bodies: list[bytes]) -> None:
        self.bodies = bodies
        self.ack_tags: list[int] = []
        self.nack_tags: list[tuple[int, bool]] = []
        self.next_tag = 1

    def basic_get(self, queue: str, auto_ack: bool):
        if not self.bodies:
            return None, None, None
        body = self.bodies.pop(0)
        method = FakeMethod(self.next_tag)
        self.next_tag += 1
        return method, None, body

    def basic_ack(self, delivery_tag: int) -> None:
        self.ack_tags.append(delivery_tag)

    def basic_nack(self, delivery_tag: int, requeue: bool) -> None:
        self.nack_tags.append((delivery_tag, requeue))


def test_rabbitmq_drain_logic_uses_shared_consumer_ack_and_reject_paths(test_context) -> None:
    valid_event = envelope("usage.point_viewed")
    unsupported_event = envelope("provider.sync.requested")
    channel = FakeChannel(
        [
            valid_event.to_message_body(),
            unsupported_event.to_message_body(),
            b"not-json",
        ],
    )
    db = get_session_factory()()
    try:
        result = drain_analytics_queue(db, channel, limit=10)
        assert result.received_count == 3
        assert result.created_count == 1
        assert result.unsupported_count == 1
        assert result.invalid_count == 1
        assert result.ack_count == 1
        assert result.reject_count == 2
        assert channel.ack_tags == [1]
        assert channel.nack_tags == [(2, False), (3, False)]
    finally:
        db.close()
