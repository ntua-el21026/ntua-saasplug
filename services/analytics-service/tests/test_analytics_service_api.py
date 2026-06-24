import csv
import io
import json
from datetime import UTC, datetime
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app import routes
from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.main import app
from app.models import (
    BillingSummarySnapshot,
    CatalogHealthSnapshot,
    EvReservationDailyMetric,
    ExportJob,
    OperatorDailyMetric,
    PointDailyMetric,
    ProviderDailyMetric,
    UsageEvent,
)
from app.rabbitmq_consumer import ConsumeResult, drain_analytics_queue
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
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("SAASPLUG_STRICT_SECRETS", "false")
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
    assert payload["ev_reservation_daily_rows"] == 0


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


def test_billing_events_create_summary_snapshots_with_amounts(test_context) -> None:
    issued_event = envelope(
        "billing.invoice_issued",
        payload={
            "invoice_id": "invoice-1",
            "amount": "12.50",
            "currency": "EUR",
            "status": "issued",
        },
    )
    paid_event = envelope(
        "billing.invoice_paid",
        payload={
            "invoice_id": "invoice-1",
            "amount": "12.50",
            "currency": "EUR",
            "status": "paid",
        },
    )

    response = ingest(test_context, [issued_event, paid_event])

    assert response.status_code == 200
    assert response.json()["created_count"] == 2
    db = get_session_factory()()
    try:
        snapshots = db.query(BillingSummarySnapshot).order_by(BillingSummarySnapshot.event_type).all()
        assert len(snapshots) == 2
        issued = next(snapshot for snapshot in snapshots if snapshot.event_type == "billing.invoice_issued")
        paid = next(snapshot for snapshot in snapshots if snapshot.event_type == "billing.invoice_paid")
        assert issued.invoice_id == "invoice-1"
        assert issued.invoiced_amount == 12.50
        assert issued.unpaid_amount == 12.50
        assert paid.paid_amount == 12.50
    finally:
        db.close()


def test_provider_tracked_revenue_uses_successful_reservation_charging_cost(test_context) -> None:
    events = [
        envelope(
            "reservation.succeeded",
            provider_code="redPlug",
            payload={
                "reservation_id": "reservation-explicit",
                "status": "succeeded",
                "estimated_cost_eur": 5.12,
                "estimated_cost_currency": "EUR",
            },
        ),
        envelope(
            "reservation.succeeded",
            provider_code="redPlug",
            payload={
                "reservation_id": "reservation-calculated",
                "status": "succeeded",
                "requested_duration_minutes": 60,
                "price_per_kwh_eur": 0.5,
                "charger_capacity_kw": 22,
            },
        ),
        envelope(
            "reservation.failed",
            provider_code="redPlug",
            payload={
                "reservation_id": "reservation-failed",
                "status": "failed",
                "estimated_cost_eur": 99,
            },
        ),
        envelope(
            "billing.charge_created",
            provider_code="redPlug",
            payload={"amount": 50, "currency": "EUR"},
        ),
    ]

    assert ingest(test_context, events).status_code == 200
    assert refresh(test_context).status_code == 200

    response = test_context.get("/provider/summary?providerCode=redPlug", headers=operator_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["successful_reservations"] == 2
    assert payload["failed_reservations"] == 1
    assert payload["observed_amount"] == 16.12
    assert payload["currency"] == "EUR"


def test_catalog_import_event_creates_catalog_health_snapshot(test_context) -> None:
    catalog_event = envelope(
        "catalog.points.imported",
        payload={
            "active_count": 10,
            "stale_count": 2,
            "imported_count": 12,
            "status": "completed",
        },
    )

    response = ingest(test_context, catalog_event)

    assert response.status_code == 200
    db = get_session_factory()()
    try:
        snapshot = db.query(CatalogHealthSnapshot).one()
        assert snapshot.provider_code == "redPlug"
        assert snapshot.active_count == 10
        assert snapshot.stale_count == 2
        assert snapshot.imported_count == 12
        assert snapshot.latest_import_status == "completed"
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


def test_provider_date_range_filters_dashboard_aggregates(test_context) -> None:
    events = [
        envelope(
            "usage.point_viewed",
            external_point_id="101",
            occurred_at=datetime(2026, 6, 10, 9, 0, tzinfo=UTC),
        ),
        envelope(
            "status.point_checked",
            external_point_id="101",
            payload={"status": "available"},
            occurred_at=datetime(2026, 6, 10, 9, 5, tzinfo=UTC),
        ),
        envelope(
            "usage.point_viewed",
            external_point_id="102",
            occurred_at=datetime(2026, 6, 12, 10, 0, tzinfo=UTC),
        ),
        envelope(
            "status.point_checked",
            external_point_id="102",
            payload={"status": "reserved"},
            occurred_at=datetime(2026, 6, 12, 10, 5, tzinfo=UTC),
        ),
        envelope(
            "reservation.succeeded",
            external_point_id="102",
            payload={"reservation_id": "reservation-2", "status": "succeeded"},
            occurred_at=datetime(2026, 6, 12, 10, 10, tzinfo=UTC),
        ),
    ]

    assert ingest(test_context, events).status_code == 200
    assert refresh(test_context).status_code == 200

    query = "providerCode=redPlug&from=2026-06-12&to=2026-06-12"
    summary = test_context.get(f"/provider/summary?{query}", headers=operator_headers())
    trends = test_context.get(f"/provider/trends/daily?{query}", headers=operator_headers())
    top_points_response = test_context.get(
        f"/provider/top-points?{query}&metric=views&limit=10",
        headers=operator_headers(),
    )
    status_response = test_context.get(f"/provider/status-distribution?{query}", headers=operator_headers())

    assert summary.status_code == 200
    summary_payload = summary.json()
    assert summary_payload["total_point_views"] == 1
    assert summary_payload["total_status_checks"] == 1
    assert summary_payload["successful_reservations"] == 1
    assert summary_payload["status_distribution"] == {"reserved": 1}

    assert trends.status_code == 200
    assert [row["day_bucket"] for row in trends.json()] == ["2026-06-12"]

    assert top_points_response.status_code == 200
    top_rows = top_points_response.json()
    assert [row["external_point_id"] for row in top_rows] == ["102"]

    assert status_response.status_code == 200
    assert status_response.json()["status_distribution"] == {"reserved": 1}


def test_ev_user_reads_own_reservation_cost_summary(test_context) -> None:
    user_id = "user-evuser@saasplug.local"
    events = [
        envelope(
            "reservation.succeeded",
            provider_code="redPlug",
            external_point_id="101",
            payload={
                "user_id": user_id,
                "reservation_id": "reservation-1",
                "status": "succeeded",
                "requested_duration_minutes": 60,
                "price_per_kwh_eur": 0.5,
                "charger_capacity_kw": 22,
            },
        ),
        envelope(
            "reservation.succeeded",
            provider_code="greenPlug",
            external_point_id="201",
            payload={
                "user_id": user_id,
                "reservation_id": "reservation-2",
                "status": "succeeded",
                "requested_duration_minutes": 30,
                "price_per_kwh_eur": None,
                "charger_capacity_kw": 50,
            },
        ),
        envelope(
            "reservation.failed",
            provider_code="bluePlug",
            external_point_id="301",
            payload={
                "user_id": user_id,
                "reservation_id": "reservation-3",
                "status": "failed",
                "requested_duration_minutes": 45,
                "error_type": "provider_http_error",
            },
        ),
    ]

    assert ingest(test_context, events).status_code == 200
    refresh_response = refresh(test_context)
    assert refresh_response.status_code == 200
    assert refresh_response.json()["ev_reservation_daily_rows"] == 1

    response = test_context.get("/ev/reservations/summary", headers=ev_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == user_id
    assert payload["total_reservations"] == 3
    assert payload["successful_reservations"] == 2
    assert payload["failed_reservations"] == 1
    assert payload["total_duration_minutes"] == 90
    assert payload["distinct_points"] == 3
    assert payload["estimated_reservations"] == 1
    assert payload["missing_estimate_count"] == 1
    assert payload["total_estimated_energy_kwh"] == 22
    assert payload["total_estimated_cost_eur"] == 11
    assert payload["average_estimated_cost_per_point_eur"] == 11
    assert payload["average_estimated_cost_per_reservation_eur"] == 11
    assert payload["currency"] == "EUR"
    assert payload["analytics_delay_notice"] == "aggregates_current"
    db = get_session_factory()()
    try:
        metric = db.query(EvReservationDailyMetric).one()
        assert metric.point_keys == ["bluePlug:301", "greenPlug:201", "redPlug:101"]
        assert metric.estimated_point_keys == ["redPlug:101"]
    finally:
        db.close()


def test_ev_summary_handles_all_missing_cost_inputs(test_context) -> None:
    event = envelope(
        "reservation.succeeded",
        payload={
            "user_id": "user-evuser@saasplug.local",
            "reservation_id": "reservation-1",
            "status": "succeeded",
            "requested_duration_minutes": 60,
            "price_per_kwh_eur": None,
            "charger_capacity_kw": None,
        },
    )

    assert ingest(test_context, event).status_code == 200
    assert refresh(test_context).status_code == 200

    response = test_context.get("/ev/reservations/summary", headers=ev_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["estimated_reservations"] == 0
    assert payload["missing_estimate_count"] == 1
    assert payload["total_estimated_energy_kwh"] is None
    assert payload["total_estimated_cost_eur"] is None
    assert payload["average_estimated_cost_per_point_eur"] is None
    assert payload["average_estimated_cost_per_reservation_eur"] is None
    assert payload["estimate_basis"] is None


def test_ev_summary_ignores_invalid_cost_inputs_but_accepts_zero_cost(test_context) -> None:
    user_id = "user-evuser@saasplug.local"
    events = [
        envelope(
            "reservation.succeeded",
            provider_code="redPlug",
            external_point_id="101",
            payload={
                "user_id": user_id,
                "reservation_id": "reservation-1",
                "status": "succeeded",
                "requested_duration_minutes": 60,
                "price_per_kwh_eur": "NaN",
                "charger_capacity_kw": 22,
            },
        ),
        envelope(
            "reservation.succeeded",
            provider_code="greenPlug",
            external_point_id="201",
            payload={
                "user_id": user_id,
                "reservation_id": "reservation-2",
                "status": "succeeded",
                "requested_duration_minutes": 60,
                "price_per_kwh_eur": 0,
                "charger_capacity_kw": 22,
            },
        ),
    ]

    assert ingest(test_context, events).status_code == 200
    assert refresh(test_context).status_code == 200

    response = test_context.get("/ev/reservations/summary", headers=ev_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["estimated_reservations"] == 1
    assert payload["missing_estimate_count"] == 1
    assert payload["total_estimated_energy_kwh"] == 22
    assert payload["total_estimated_cost_eur"] == 0
    assert payload["average_estimated_cost_per_point_eur"] == 0
    assert payload["average_estimated_cost_per_reservation_eur"] == 0
    assert payload["estimate_basis"] == "rated_power_duration_estimate"


def test_repeated_aggregate_refresh_updates_existing_metric_rows(test_context) -> None:
    event = envelope("usage.point_viewed")
    assert ingest(test_context, event).status_code == 200

    first_refresh = refresh(test_context)
    second_refresh = refresh(test_context)

    assert first_refresh.status_code == 200
    assert second_refresh.status_code == 200
    db = get_session_factory()()
    try:
        assert db.query(ProviderDailyMetric).count() == 1
        assert db.query(PointDailyMetric).count() == 1
        assert db.query(OperatorDailyMetric).count() == 1
        assert db.query(ProviderDailyMetric).one().point_views == 1
    finally:
        db.close()


def test_latest_point_observations_update_status_distribution(test_context) -> None:
    seed_analytics_events(test_context)

    response = test_context.get("/provider/status-distribution?providerCode=redPlug", headers=operator_headers())

    assert response.status_code == 200
    assert response.json()["status_distribution"] == {"reserved": 1}


def test_reservation_success_replaces_an_older_point_status_observation(test_context) -> None:
    events = [
        envelope(
            "status.point_checked",
            payload={"status": "available"},
            occurred_at=datetime(2026, 6, 12, 10, 0, tzinfo=UTC),
        ),
        envelope(
            "reservation.succeeded",
            payload={"reservation_id": "reservation-1", "status": "succeeded", "provider_status": "reserved"},
            occurred_at=datetime(2026, 6, 12, 10, 1, tzinfo=UTC),
        ),
    ]

    assert ingest(test_context, events).status_code == 200
    assert refresh(test_context).status_code == 200

    response = test_context.get("/provider/status-distribution?providerCode=redPlug", headers=operator_headers())

    assert response.status_code == 200
    assert response.json()["status_distribution"] == {"reserved": 1}


def test_provider_admin_can_access_only_own_provider_analytics(test_context) -> None:
    seed_analytics_events(test_context)

    own_response = test_context.get("/provider/summary", headers=red_admin_headers())
    other_response = test_context.get("/provider/summary?providerCode=greenPlug", headers=red_admin_headers())

    assert own_response.status_code == 200
    assert own_response.json()["provider_code"] == "redPlug"
    assert other_response.status_code == 403


def test_operator_can_refresh_analytics_data(test_context, monkeypatch) -> None:
    captured: dict[str, int] = {}

    def fake_consume_analytics_events(settings, db, limit):
        captured["limit"] = limit
        return ConsumeResult(
            requested_limit=limit,
            received_count=1,
            ack_count=1,
            created_count=1,
        )

    monkeypatch.setattr(routes, "consume_analytics_events", fake_consume_analytics_events)

    response = test_context.post("/operator/refresh?limit=100", headers=operator_headers())
    provider_response = test_context.post("/operator/refresh", headers=red_admin_headers())
    ev_response = test_context.post("/operator/refresh", headers=ev_headers())

    assert response.status_code == 200
    assert captured["limit"] == 50
    payload = response.json()
    assert payload["consumed"]["ack_count"] == 1
    assert payload["aggregates"]["usage_event_count"] == 0
    assert provider_response.status_code == 403
    assert ev_response.status_code == 403


def test_provider_admin_cannot_export_another_provider(test_context) -> None:
    seed_analytics_events(test_context)

    response = test_context.get("/exports/usage.csv?providerCode=greenPlug", headers=red_admin_headers())

    assert response.status_code == 403


def test_ev_user_cannot_access_provider_or_operator_analytics(test_context) -> None:
    provider_response = test_context.get("/provider/summary", headers=ev_headers())
    operator_response = test_context.get("/operator/summary", headers=ev_headers())

    assert provider_response.status_code == 403
    assert operator_response.status_code == 403


def test_provider_admin_cannot_access_ev_reservation_summary(test_context) -> None:
    provider_response = test_context.get("/ev/reservations/summary", headers=red_admin_headers())
    operator_response = test_context.get("/ev/reservations/summary", headers=operator_headers())

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


def test_provider_csv_export_omits_user_ids_and_raw_payload_details(test_context) -> None:
    seed_analytics_events(test_context)

    response = test_context.get("/exports/usage.csv", headers=red_admin_headers())

    assert response.status_code == 200
    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert rows
    assert "user_id" not in rows[0]
    assert "details" not in rows[0]
    assert "reservation_id" not in rows[0]
    assert "reservation_reference" in rows[0]
    assert "user-1" not in response.text
    assert '"user_id"' not in response.text
    assert '"reservation_id"' not in response.text


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
