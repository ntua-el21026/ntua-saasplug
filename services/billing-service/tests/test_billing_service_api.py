import json
from datetime import UTC, datetime
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app import routes
from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.event_publisher import publish_pending_outbox
from app.main import app
from app.models import BillingEvent, BillingEventOutbox, ChargeRecord, Invoice, Payment
from app.pricing import seed_default_pricing
from app.rabbitmq_consumer import drain_billing_queue
from saasplug_events.envelope import EventEnvelope


class FakeOutboxPublisher:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.envelopes = []
        self.closed = False

    def publish(self, envelope) -> None:
        if self.fail:
            raise RuntimeError("publish failed")
        self.envelopes.append(envelope)

    def close(self) -> None:
        self.closed = True


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


def access_token(roles: list[str], email: str, provider_code: str | None = None) -> str:
    return jwt.encode(
        {
            "sub": f"user-{email}",
            "email": email,
            "roles": roles,
            "provider_id": provider_code,
            "provider_code": provider_code,
        },
        "billing-test-secret",
        algorithm="HS256",
    )


def auth_headers(roles: list[str], email: str, provider_code: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token(roles, email, provider_code)}"}


def operator_headers() -> dict[str, str]:
    return auth_headers(["OPERATOR"], "operator@saasplug.local")


def red_admin_headers() -> dict[str, str]:
    return auth_headers(["PROVIDER_ADMIN"], "red-admin@saasplug.local", "redPlug")


def green_admin_headers() -> dict[str, str]:
    return auth_headers(["PROVIDER_ADMIN"], "green-admin@saasplug.local", "greenPlug")


def ev_headers() -> dict[str, str]:
    return auth_headers(["EV_USER"], "evuser@saasplug.local")


def envelope(
    event_type: str = "reservation.succeeded",
    provider_code: str = "redPlug",
    payload: dict | None = None,
) -> EventEnvelope:
    base_payload = {
        "provider_code": provider_code,
        "reservation_id": f"reservation-{provider_code}-1",
        "user_id": "user-1",
        "external_point_id": "101",
        "normalized_point_id": f"{provider_code}:101",
        "status": "succeeded",
    }
    if payload:
        base_payload.update(payload)
    return EventEnvelope(
        event_id=uuid4(),
        event_type=event_type,
        event_version=1,
        occurred_at=datetime(2026, 6, 12, 10, 15, tzinfo=UTC),
        correlation_id=uuid4(),
        producer="billing-test",
        payload=base_payload,
    )


def event_json(event: EventEnvelope) -> dict:
    return json.loads(event.model_dump_json())


@pytest.fixture()
def test_context(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'billing-test.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SERVICE_NAME", "billing-service")
    monkeypatch.setenv("JWT_SECRET", "billing-test-secret")
    monkeypatch.setenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
    monkeypatch.setenv("RABBITMQ_EVENT_EXCHANGE", "saasplug.events")
    monkeypatch.setenv("BILLING_RABBITMQ_CONSUME_BATCH_SIZE", "50")
    monkeypatch.setenv("BILLING_RABBITMQ_CONSUME_TIMEOUT_SECONDS", "2")
    monkeypatch.setenv("BILLING_RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP", "false")
    monkeypatch.setenv("SCHEDULER_INTERNAL_TOKEN", "scheduler-test-token")
    get_settings.cache_clear()
    reset_database_for_tests(database_url)
    with TestClient(app) as test_client:
        yield test_client
    get_settings.cache_clear()


def ingest(client: TestClient, event: EventEnvelope):
    return client.post("/events/ingest", json=event_json(event), headers=operator_headers())


def create_provider_pricing(client: TestClient, provider_code: str, **overrides):
    body = {
        "provider_code": provider_code,
        "name": f"{provider_code} test pricing",
        "active": True,
        "currency": "EUR",
        "reservation_success_fee": "0.75",
        "point_view_fee": "0.02",
        "point_view_fee_enabled": True,
        "reservation_failure_fee": "0.00",
    }
    body.update(overrides)
    return client.post("/pricing/rules", json=body, headers=operator_headers())


def issue_invoice_for_red(client: TestClient):
    return client.post(
        "/invoices/issue",
        json={
            "provider_code": "redPlug",
            "period_start": "2026-06-12T00:00:00Z",
            "period_end": "2026-06-13T00:00:00Z",
        },
        headers=operator_headers(),
    )


def scheduler_headers() -> dict[str, str]:
    return {"X-Scheduler-Token": "scheduler-test-token", "X-Job-Run-Id": "scheduler-run-1"}


def test_health_endpoint_still_works(test_context) -> None:
    response = test_context.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_scheduler_internal_invoice_prepare_requires_scheduler_token(test_context) -> None:
    response = test_context.post("/internal/jobs/invoices/prepare")

    assert response.status_code == 401


def test_scheduler_internal_invoice_prepare_is_read_only(test_context) -> None:
    assert ingest(test_context, envelope()).status_code == 200

    response = test_context.post("/internal/jobs/invoices/prepare", headers=scheduler_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "prepared"
    assert payload["total_unbilled_charge_count"] == 1
    db = get_session_factory()()
    try:
        assert db.query(Invoice).count() == 0
        assert db.query(ChargeRecord).one().status == "unbilled"
    finally:
        db.close()


def test_default_pricing_seed_is_idempotent(test_context) -> None:
    db = get_session_factory()()
    try:
        settings = get_settings()
        first = seed_default_pricing(db, settings)
        second = seed_default_pricing(db, settings)
        assert first.id == second.id
        response = test_context.get("/pricing/rules", headers=operator_headers())
        assert response.status_code == 200
        assert len([rule for rule in response.json() if rule["provider_code"] is None and rule["active"]]) == 1
    finally:
        db.close()


def test_operator_can_create_update_pricing_provider_admin_cannot(test_context) -> None:
    response = create_provider_pricing(test_context, "redPlug")
    assert response.status_code == 201
    rule_id = response.json()["id"]

    update_response = test_context.patch(
        f"/pricing/rules/{rule_id}",
        json={"point_view_fee_enabled": False, "reservation_success_fee": "0.80"},
        headers=operator_headers(),
    )
    provider_create_response = test_context.post(
        "/pricing/rules",
        json={"provider_code": "redPlug"},
        headers=red_admin_headers(),
    )

    assert update_response.status_code == 200
    assert update_response.json()["point_view_fee_enabled"] is False
    assert update_response.json()["reservation_success_fee"] == "0.80"
    assert provider_create_response.status_code == 403


def test_provider_admin_can_read_own_effective_pricing_only(test_context) -> None:
    create_provider_pricing(test_context, "redPlug", reservation_success_fee="0.90")

    own_response = test_context.get("/pricing/effective/redPlug", headers=red_admin_headers())
    other_response = test_context.get("/pricing/effective/greenPlug", headers=red_admin_headers())

    assert own_response.status_code == 200
    assert own_response.json()["provider_code"] == "redPlug"
    assert own_response.json()["reservation_success_fee"] == "0.90"
    assert other_response.status_code == 403


def test_manual_ingest_reservation_success_creates_one_charge_and_outbox(test_context) -> None:
    event = envelope("reservation.succeeded")

    response = ingest(test_context, event)

    assert response.status_code == 200
    assert response.json()["charged_count"] == 1
    db = get_session_factory()()
    try:
        charge = db.query(ChargeRecord).one()
        outbox = db.query(BillingEventOutbox).one()
        assert charge.source_event_id == str(event.event_id)
        assert charge.charge_type == "reservation_success"
        assert charge.status == "unbilled"
        assert outbox.event_type == "billing.charge_created"
        assert outbox.payload["charge_id"] == charge.id
    finally:
        db.close()


def test_duplicate_reservation_success_event_does_not_create_second_charge(test_context) -> None:
    event = envelope("reservation.succeeded")
    assert ingest(test_context, event).json()["charged_count"] == 1

    response = ingest(test_context, event)

    assert response.status_code == 200
    assert response.json()["duplicate_count"] == 1
    db = get_session_factory()()
    try:
        assert db.query(ChargeRecord).count() == 1
        assert db.query(BillingEventOutbox).count() == 1
    finally:
        db.close()


def test_reservation_failed_is_recorded_and_skipped_by_default(test_context) -> None:
    event = envelope("reservation.failed", payload={"status": "failed", "error_type": "provider_timeout"})

    response = ingest(test_context, event)

    assert response.status_code == 200
    assert response.json()["skipped_count"] == 1
    db = get_session_factory()()
    try:
        stored_event = db.query(BillingEvent).one()
        assert stored_event.result == "skipped"
        assert db.query(ChargeRecord).count() == 0
    finally:
        db.close()


def test_usage_point_viewed_charges_only_when_enabled(test_context) -> None:
    enabled_event = envelope("usage.point_viewed", payload={"reservation_id": None})
    assert ingest(test_context, enabled_event).json()["charged_count"] == 1
    create_provider_pricing(test_context, "redPlug", point_view_fee_enabled=False)
    disabled_event = envelope("usage.point_viewed", payload={"reservation_id": None, "external_point_id": "102"})

    response = ingest(test_context, disabled_event)

    assert response.status_code == 200
    assert response.json()["skipped_count"] == 1
    db = get_session_factory()()
    try:
        assert db.query(ChargeRecord).count() == 1
    finally:
        db.close()


def test_operator_can_issue_invoice_and_charges_become_invoiced(test_context) -> None:
    assert ingest(test_context, envelope("reservation.succeeded")).status_code == 200

    response = issue_invoice_for_red(test_context)

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "issued"
    assert len(payload["lines"]) == 1
    db = get_session_factory()()
    try:
        charge = db.query(ChargeRecord).one()
        invoice = db.query(Invoice).one()
        assert charge.status == "invoiced"
        assert charge.invoice_id == invoice.id
        assert db.query(BillingEventOutbox).filter(BillingEventOutbox.event_type == "billing.invoice_issued").count() == 1
    finally:
        db.close()


def test_provider_admin_cannot_issue_invoices(test_context) -> None:
    response = test_context.post(
        "/invoices/issue",
        json={
            "provider_code": "redPlug",
            "period_start": "2026-06-12T00:00:00Z",
            "period_end": "2026-06-13T00:00:00Z",
        },
        headers=red_admin_headers(),
    )

    assert response.status_code == 403


def test_provider_admin_can_view_and_pay_own_issued_invoice(test_context) -> None:
    assert ingest(test_context, envelope("reservation.succeeded")).status_code == 200
    invoice_id = issue_invoice_for_red(test_context).json()["id"]

    view_response = test_context.get(f"/invoices/{invoice_id}", headers=red_admin_headers())
    pay_response = test_context.post(
        f"/invoices/{invoice_id}/pay",
        json={"mock_payment_reference": "TEST-PAYMENT-1"},
        headers=red_admin_headers(),
    )

    assert view_response.status_code == 200
    assert pay_response.status_code == 200
    assert pay_response.json()["status"] == "paid"
    assert pay_response.json()["payments"][0]["mock_payment_reference"] == "TEST-PAYMENT-1"
    db = get_session_factory()()
    try:
        assert db.query(Invoice).one().status == "paid"
        assert db.query(ChargeRecord).one().status == "paid"
        assert db.query(Payment).count() == 1
        assert db.query(BillingEventOutbox).filter(BillingEventOutbox.event_type == "billing.invoice_paid").count() == 1
    finally:
        db.close()


def test_provider_admin_cannot_view_or_pay_another_provider_invoice(test_context) -> None:
    assert ingest(test_context, envelope("reservation.succeeded")).status_code == 200
    invoice_id = issue_invoice_for_red(test_context).json()["id"]

    view_response = test_context.get(f"/invoices/{invoice_id}", headers=green_admin_headers())
    pay_response = test_context.post(f"/invoices/{invoice_id}/pay", headers=green_admin_headers())

    assert view_response.status_code == 403
    assert pay_response.status_code == 403


def test_repaying_paid_invoice_returns_conflict(test_context) -> None:
    assert ingest(test_context, envelope("reservation.succeeded")).status_code == 200
    invoice_id = issue_invoice_for_red(test_context).json()["id"]
    assert test_context.post(f"/invoices/{invoice_id}/pay", headers=red_admin_headers()).status_code == 200

    response = test_context.post(f"/invoices/{invoice_id}/pay", headers=red_admin_headers())

    assert response.status_code == 409
    assert response.json()["detail"]["error_type"] == "invoice_already_paid"


def test_operator_and_provider_billing_overviews_return_expected_totals(test_context) -> None:
    assert ingest(test_context, envelope("reservation.succeeded")).status_code == 200
    invoice_id = issue_invoice_for_red(test_context).json()["id"]
    assert test_context.post(f"/invoices/{invoice_id}/pay", headers=red_admin_headers()).status_code == 200

    operator_response = test_context.get("/overview", headers=operator_headers())
    provider_response = test_context.get("/providers/redPlug/overview", headers=red_admin_headers())

    assert operator_response.status_code == 200
    assert provider_response.status_code == 200
    assert operator_response.json()["paid_invoice_count"] == 1
    assert provider_response.json()["provider_code"] == "redPlug"
    assert provider_response.json()["paid_charge_count"] == 1
    assert provider_response.json()["effective_pricing"]["currency"] == "EUR"


def test_outbox_publish_success_and_failure_are_deterministic(test_context) -> None:
    assert ingest(test_context, envelope("reservation.succeeded")).status_code == 200
    db = get_session_factory()()
    try:
        success_publisher = FakeOutboxPublisher()
        success_result = publish_pending_outbox(db, success_publisher, limit=50)
        assert success_result.published_count == 1
        assert len(success_publisher.envelopes) == 1

        event = db.query(BillingEventOutbox).one()
        event.publish_status = "pending"
        db.commit()
        failed_publisher = FakeOutboxPublisher(fail=True)
        failed_result = publish_pending_outbox(db, failed_publisher, limit=50)
        assert failed_result.failed_count == 1
        assert db.query(BillingEventOutbox).one().last_publish_error == "publish failed"
    finally:
        db.close()


def test_operator_can_publish_pending_outbox_through_endpoint(test_context, monkeypatch) -> None:
    assert ingest(test_context, envelope("reservation.succeeded")).status_code == 200
    fake_publisher = FakeOutboxPublisher()
    monkeypatch.setattr(routes, "build_billing_publisher", lambda settings: fake_publisher)

    response = test_context.post("/events/outbox/publish-pending", headers=operator_headers())

    assert response.status_code == 200
    assert response.json()["published_count"] == 1
    assert fake_publisher.closed is True


def test_rabbitmq_drain_logic_processes_fake_deliveries_idempotently(test_context) -> None:
    valid_event = envelope("reservation.succeeded")
    duplicate_event = valid_event
    unsupported_event = envelope("provider.sync.requested")
    channel = FakeChannel(
        [
            valid_event.to_message_body(),
            duplicate_event.to_message_body(),
            unsupported_event.to_message_body(),
            b"not-json",
        ],
    )
    db = get_session_factory()()
    try:
        result = drain_billing_queue(get_settings(), db, channel, limit=10)
        assert result.received_count == 4
        assert result.charged_count == 1
        assert result.duplicate_count == 1
        assert result.unsupported_count == 1
        assert result.invalid_count == 1
        assert result.ack_count == 2
        assert result.reject_count == 2
        assert channel.ack_tags == [1, 2]
        assert channel.nack_tags == [(3, False), (4, False)]
    finally:
        db.close()


def test_ev_user_cannot_access_billing_admin_routes(test_context) -> None:
    charges_response = test_context.get("/charges", headers=ev_headers())
    overview_response = test_context.get("/overview", headers=ev_headers())

    assert charges_response.status_code == 403
    assert overview_response.status_code == 403
