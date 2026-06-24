from datetime import timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app import reservation_logic
from app import routes
from app.catalog_client import CatalogServiceError
from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.event_publisher import outbox_row_to_envelope, publish_pending_outbox
from app.main import app
from app.models import (
    Reservation,
    ReservationAttempt,
    ReservationEventOutbox,
    ReservationIdempotencyRecord,
    ReservationPointLock,
    utcnow,
)
from app.provider_client import ProviderServiceError
from app.schemas import CatalogPointDTO, ProviderReservationDTO


def catalog_point(
    provider_code: str = "redPlug",
    external_point_id: str = "101",
    active: bool = True,
    stale: bool = False,
    price_per_kwh_eur: float | None = 0.29,
    capacity: float | None = 22,
) -> dict:
    return {
        "id": f"catalog-{provider_code}-{external_point_id}",
        "normalized_point_id": f"{provider_code}:{external_point_id}",
        "provider_code": provider_code,
        "external_point_id": external_point_id,
        "price_per_kwh_eur": price_per_kwh_eur,
        "capacity": capacity,
        "is_active": active,
        "is_stale": stale,
    }


def provider_reservation(provider_code: str = "redPlug", external_point_id: str = "101") -> dict:
    return {
        "provider_code": provider_code,
        "external_point_id": external_point_id,
        "normalized_point_id": f"{provider_code}:{external_point_id}",
        "provider_reservation_id": f"{provider_code}-{external_point_id}-reservation",
        "status": "reserved",
        "reservation_ends_at": "2099-06-12T12:00:00Z",
        "price_per_kwh_eur": 0.31,
        "raw_payload": {"providerReservationId": "raw-id", "api_key": "secret-provider-key"},
    }


class FakeCatalogServiceClient:
    def __init__(self, call_order: list[str]) -> None:
        self.points = {
            ("redPlug", "101"): catalog_point("redPlug", "101"),
            ("greenPlug", "201"): catalog_point("greenPlug", "201"),
            ("bluePlug", "301"): catalog_point("bluePlug", "301", active=False),
        }
        self.failures: dict[tuple[str, str], CatalogServiceError] = {}
        self.calls: list[tuple[str, str]] = []
        self.call_order = call_order

    def close(self) -> None:
        return None

    def get_point(self, provider_code: str, external_point_id: str) -> CatalogPointDTO:
        self.calls.append((provider_code, external_point_id))
        self.call_order.append("catalog")
        failure = self.failures.get((provider_code, external_point_id))
        if failure is not None:
            raise failure
        return CatalogPointDTO.model_validate(self.points[(provider_code, external_point_id)])


class FakeProviderServiceClient:
    def __init__(self, call_order: list[str]) -> None:
        self.reservations = {
            ("redPlug", "101"): provider_reservation("redPlug", "101"),
            ("greenPlug", "201"): provider_reservation("greenPlug", "201"),
        }
        self.failures: dict[tuple[str, str], ProviderServiceError] = {}
        self.calls: list[tuple[str, str, int]] = []
        self.call_order = call_order

    def close(self) -> None:
        return None

    def reserve_point(
        self,
        provider_code: str,
        external_point_id: str,
        duration_minutes: int,
    ) -> ProviderReservationDTO:
        self.calls.append((provider_code, external_point_id, duration_minutes))
        self.call_order.append("provider")
        failure = self.failures.get((provider_code, external_point_id))
        if failure is not None:
            raise failure
        return ProviderReservationDTO.model_validate(self.reservations[(provider_code, external_point_id)])


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


def access_token(roles: list[str], email: str, provider_code: str | None = None) -> str:
    return jwt.encode(
        {
            "sub": f"user-{email}",
            "email": email,
            "roles": roles,
            "provider_id": provider_code,
            "provider_code": provider_code,
        },
        "reservation-test-secret",
        algorithm="HS256",
    )


def auth_headers(roles: list[str], email: str, provider_code: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token(roles, email, provider_code)}"}


def ev_headers(email: str = "evuser@saasplug.local") -> dict[str, str]:
    return auth_headers(["EV_USER"], email)


def operator_headers() -> dict[str, str]:
    return auth_headers(["OPERATOR"], "operator@saasplug.local")


def red_admin_headers() -> dict[str, str]:
    return auth_headers(["PROVIDER_ADMIN"], "red-admin@saasplug.local", "redPlug")


def scheduler_headers() -> dict[str, str]:
    return {"X-Scheduler-Token": "scheduler-test-token", "X-Job-Run-Id": "scheduler-run-1"}


@pytest.fixture()
def test_context(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'reservation-test.db'}"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("SAASPLUG_STRICT_SECRETS", "false")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SERVICE_NAME", "reservation-service")
    monkeypatch.setenv("JWT_SECRET", "reservation-test-secret")
    monkeypatch.setenv("RESERVATION_CATALOG_SERVICE_URL", "http://catalog-service:8000")
    monkeypatch.setenv("RESERVATION_PROVIDER_TIMEOUT_SECONDS", "2")
    monkeypatch.setenv("RABBITMQ_EVENT_EXCHANGE", "saasplug.events")
    monkeypatch.setenv("RABBITMQ_PUBLISH_TIMEOUT_SECONDS", "2")
    monkeypatch.setenv("RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP", "false")
    monkeypatch.setenv("RESERVATION_OUTBOX_PUBLISH_BATCH_SIZE", "50")
    monkeypatch.setenv("SCHEDULER_INTERNAL_TOKEN", "scheduler-test-token")
    get_settings.cache_clear()
    reset_database_for_tests(database_url)
    call_order: list[str] = []
    fake_catalog = FakeCatalogServiceClient(call_order)
    fake_provider = FakeProviderServiceClient(call_order)
    monkeypatch.setattr(routes, "CatalogServiceClient", lambda settings: fake_catalog)
    monkeypatch.setattr(routes, "ProviderServiceClient", lambda settings: fake_provider)
    with TestClient(app) as test_client:
        yield test_client, fake_catalog, fake_provider, call_order
    get_settings.cache_clear()


def create_db_reservation(
    provider_code: str,
    external_point_id: str,
    user_email: str = "evuser@saasplug.local",
) -> str:
    db = get_session_factory()()
    try:
        reservation = Reservation(
            user_id=f"user-{user_email}",
            user_email=user_email,
            provider_code=provider_code,
            external_point_id=external_point_id,
            normalized_point_id=f"{provider_code}:{external_point_id}",
            catalog_point_id=f"catalog-{provider_code}-{external_point_id}",
            requested_duration_minutes=60,
            status="succeeded",
            provider_status="reserved",
            provider_reservation_id=f"{provider_code}-{external_point_id}-reservation",
            reservation_ends_at="2099-06-12T12:00:00Z",
        )
        db.add(reservation)
        db.commit()
        db.refresh(reservation)
        return reservation.id
    finally:
        db.close()


def test_health_endpoint_still_works(test_context) -> None:
    client, _, _, _ = test_context

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_strict_secret_validation_rejects_scheduler_and_rabbitmq_placeholders(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("SAASPLUG_STRICT_SECRETS", "true")
    monkeypatch.setenv("JWT_SECRET", "strict-reservation-jwt-secret")
    monkeypatch.setenv("SCHEDULER_INTERNAL_TOKEN", "change-me-scheduler-token")
    monkeypatch.setenv("RABBITMQ_URL", "amqp://strict-user:strict-password@rabbitmq:5672/")

    with pytest.raises(RuntimeError, match="SCHEDULER_INTERNAL_TOKEN"):
        get_settings()

    get_settings.cache_clear()
    monkeypatch.setenv("SCHEDULER_INTERNAL_TOKEN", "strict-scheduler-token")
    monkeypatch.setenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

    with pytest.raises(RuntimeError, match="RABBITMQ_URL"):
        get_settings()

    get_settings.cache_clear()


def test_scheduler_internal_freshness_requires_scheduler_token(test_context) -> None:
    client, _, _, _ = test_context

    missing = client.get("/internal/jobs/freshness")
    missing_run_id = client.get("/internal/jobs/freshness", headers={"X-Scheduler-Token": "scheduler-test-token"})
    allowed = client.get("/internal/jobs/freshness", headers=scheduler_headers())

    assert missing.status_code == 401
    assert missing_run_id.status_code == 400
    assert allowed.status_code == 200
    assert allowed.json()["pending_outbox_count"] == 0


def test_scheduler_internal_outbox_publish_uses_service_owned_publisher(test_context, monkeypatch) -> None:
    client, _, _, _ = test_context
    assert client.post("/points/redPlug/101/reservations", headers=ev_headers()).status_code == 201
    fake_publisher = FakeOutboxPublisher()
    monkeypatch.setattr(routes, "build_rabbitmq_publisher", lambda settings: fake_publisher)

    response = client.post("/internal/jobs/outbox/publish-pending", headers=scheduler_headers())

    assert response.status_code == 200
    assert response.json()["published_count"] == 1
    assert fake_publisher.closed is True


def test_ev_user_creates_successful_reservation_and_stages_outbox(test_context) -> None:
    client, fake_catalog, fake_provider, call_order = test_context

    response = client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 45},
        headers=ev_headers(),
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "succeeded"
    assert payload["provider_status"] == "reserved"
    assert payload["requested_duration_minutes"] == 45
    assert payload["price_per_kwh_eur"] == 0.31
    assert payload["charger_capacity_kw"] == 22
    assert payload["estimated_energy_kwh"] == 16.5
    assert payload["estimated_cost_eur"] == 5.12
    assert payload["estimated_cost_currency"] == "EUR"
    assert payload["estimate_basis"] == "rated_power_duration_estimate"
    assert fake_catalog.calls == [("redPlug", "101")]
    assert fake_provider.calls == [("redPlug", "101", 45)]
    assert call_order == ["catalog", "provider"]
    db = get_session_factory()()
    try:
        reservation = db.query(Reservation).one()
        attempt = db.query(ReservationAttempt).one()
        event = db.query(ReservationEventOutbox).one()
        assert reservation.status == "succeeded"
        assert reservation.raw_provider_payload["api_key"] == "[redacted]"
        assert attempt.result_status == "succeeded"
        assert attempt.provider_called is True
        assert event.event_type == "reservation.succeeded"
        assert event.publish_status == "pending"
        assert event.correlation_id == reservation.id
        assert event.payload["reservation_id"] == reservation.id
        assert event.payload["charger_capacity_kw"] == 22
        assert event.payload["estimated_energy_kwh"] == 16.5
        assert event.payload["estimated_cost_eur"] == 5.12
    finally:
        db.close()


def test_duplicate_idempotency_key_returns_same_reservation(test_context) -> None:
    client, _, fake_provider, _ = test_context
    headers = {**ev_headers(), "Idempotency-Key": "reservation-key-1"}

    first_response = client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 45},
        headers=headers,
    )
    second_response = client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 45},
        headers=headers,
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert second_response.json()["id"] == first_response.json()["id"]
    assert fake_provider.calls == [("redPlug", "101", 45)]
    db = get_session_factory()()
    try:
        assert db.query(Reservation).count() == 1
        assert db.query(ReservationAttempt).count() == 1
        assert db.query(ReservationEventOutbox).count() == 1
        record = db.query(ReservationIdempotencyRecord).one()
        assert record.status == "succeeded"
        assert record.reservation_id == first_response.json()["id"]
    finally:
        db.close()


def test_same_idempotency_key_with_different_request_returns_conflict(test_context) -> None:
    client, _, fake_provider, _ = test_context
    headers = {**ev_headers(), "Idempotency-Key": "reservation-key-2"}
    assert client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 45},
        headers=headers,
    ).status_code == 201

    response = client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 60},
        headers=headers,
    )

    assert response.status_code == 409
    assert response.json()["detail"]["error_type"] == "idempotency_key_conflict"
    assert fake_provider.calls == [("redPlug", "101", 45)]


def test_duplicate_in_progress_idempotency_key_does_not_call_provider(test_context) -> None:
    client, _, fake_provider, _ = test_context
    db = get_session_factory()()
    try:
        db.add(
            ReservationIdempotencyRecord(
                idempotency_key="reservation-key-in-progress",
                request_fingerprint=reservation_logic.reservation_request_fingerprint(
                    reservation_logic.CurrentPrincipal(
                        sub="user-evuser@saasplug.local",
                        email="evuser@saasplug.local",
                        roles=["EV_USER"],
                    ),
                    "redPlug",
                    "101",
                    60,
                ),
                user_id="user-evuser@saasplug.local",
                provider_code="redPlug",
                external_point_id="101",
                requested_duration_minutes=60,
                status="in_progress",
            ),
        )
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/points/redPlug/101/reservations",
        headers={**ev_headers(), "Idempotency-Key": "reservation-key-in-progress"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["error_type"] == "reservation_request_in_progress"
    assert fake_provider.calls == []


def test_existing_active_local_reservation_prevents_provider_call(test_context) -> None:
    client, _, fake_provider, _ = test_context
    create_db_reservation("redPlug", "101")

    response = client.post("/points/redPlug/101/reservations", headers=ev_headers())

    assert response.status_code == 409
    assert response.json()["detail"]["error_type"] == "reservation_already_active"
    assert fake_provider.calls == []
    db = get_session_factory()()
    try:
        assert db.query(Reservation).count() == 1
        attempt = db.query(ReservationAttempt).one()
        assert attempt.provider_called is False
        assert attempt.provider_error_type == "reservation_already_active"
    finally:
        db.close()


def test_existing_point_lock_guards_near_simultaneous_same_point_requests(test_context) -> None:
    client, _, fake_provider, _ = test_context
    db = get_session_factory()()
    try:
        db.add(
            ReservationPointLock(
                normalized_point_id="redPlug:101",
                provider_code="redPlug",
                external_point_id="101",
                owner_id="in-flight-request",
                acquired_at=utcnow(),
                expires_at=utcnow() + timedelta(seconds=60),
            ),
        )
        db.commit()
    finally:
        db.close()

    response = client.post("/points/redPlug/101/reservations", headers=ev_headers())

    assert response.status_code == 409
    assert response.json()["detail"]["error_type"] == "reservation_request_in_progress"
    assert fake_provider.calls == []


def test_successful_reservation_falls_back_to_catalog_price_for_estimate(test_context) -> None:
    client, _, fake_provider, _ = test_context
    fake_provider.reservations[("redPlug", "101")]["price_per_kwh_eur"] = None

    response = client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 60},
        headers=ev_headers(),
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["price_per_kwh_eur"] == 0.29
    assert payload["charger_capacity_kw"] == 22
    assert payload["estimated_energy_kwh"] == 22
    assert payload["estimated_cost_eur"] == 6.38


def test_invalid_provider_price_falls_back_to_catalog_price(test_context) -> None:
    client, _, fake_provider, _ = test_context
    fake_provider.reservations[("redPlug", "101")]["price_per_kwh_eur"] = -0.25

    response = client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 30},
        headers=ev_headers(),
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["price_per_kwh_eur"] == 0.29
    assert payload["charger_capacity_kw"] == 22
    assert payload["estimated_energy_kwh"] == 11
    assert payload["estimated_cost_eur"] == 3.19


def test_missing_cost_inputs_keep_estimate_unavailable(test_context) -> None:
    client, fake_catalog, fake_provider, _ = test_context
    fake_catalog.points[("redPlug", "101")] = catalog_point(
        "redPlug",
        "101",
        price_per_kwh_eur=None,
        capacity=None,
    )
    fake_provider.reservations[("redPlug", "101")]["price_per_kwh_eur"] = None

    response = client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 60},
        headers=ev_headers(),
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["price_per_kwh_eur"] is None
    assert payload["charger_capacity_kw"] is None
    assert payload["estimated_energy_kwh"] is None
    assert payload["estimated_cost_eur"] is None
    assert payload["estimated_cost_currency"] is None
    assert payload["estimate_basis"] is None


def test_invalid_capacity_keeps_estimate_unavailable(test_context) -> None:
    client, fake_catalog, _, _ = test_context
    fake_catalog.points[("redPlug", "101")] = catalog_point(
        "redPlug",
        "101",
        price_per_kwh_eur=0.29,
        capacity=0,
    )

    response = client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 60},
        headers=ev_headers(),
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["price_per_kwh_eur"] == 0.31
    assert payload["charger_capacity_kw"] is None
    assert payload["estimated_energy_kwh"] is None
    assert payload["estimated_cost_eur"] is None
    assert payload["estimated_cost_currency"] is None
    assert payload["estimate_basis"] is None


def test_provider_failure_is_persisted_and_returns_safe_error(test_context) -> None:
    client, _, fake_provider, _ = test_context
    fake_provider.failures[("redPlug", "101")] = ProviderServiceError(
        "redPlug",
        "provider_http_error",
        "raw-secret-provider-error",
        status_code=502,
        external_status_code=403,
    )

    response = client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 30},
        headers=ev_headers(),
    )

    assert response.status_code == 502
    assert "raw-secret-provider-error" not in str(response.json())
    assert response.json()["detail"]["error_type"] == "provider_http_error"
    db = get_session_factory()()
    try:
        reservation = db.query(Reservation).one()
        attempt = db.query(ReservationAttempt).one()
        event = db.query(ReservationEventOutbox).one()
        assert reservation.status == "failed"
        assert reservation.price_per_kwh_eur == 0.29
        assert reservation.charger_capacity_kw == 22
        assert reservation.estimated_cost_eur is None
        assert reservation.failure_reason == "Provider reservation request failed"
        assert attempt.result_status == "failed"
        assert attempt.provider_error_message == "Provider reservation request failed"
        assert attempt.external_status_code == 403
        assert event.event_type == "reservation.failed"
    finally:
        db.close()


def test_provider_already_reserved_rejection_returns_conflict_and_failed_event(test_context) -> None:
    client, _, fake_provider, _ = test_context
    fake_provider.failures[("redPlug", "101")] = ProviderServiceError(
        "redPlug",
        "provider_http_error",
        "provider says point is reserved",
        status_code=409,
        external_status_code=409,
    )

    response = client.post(
        "/points/redPlug/101/reservations",
        json={"duration_minutes": 30},
        headers=ev_headers(),
    )

    assert response.status_code == 409
    assert response.json()["detail"]["message"] == "This charger is no longer available. Refresh status or choose another point."
    db = get_session_factory()()
    try:
        reservation = db.query(Reservation).one()
        event = db.query(ReservationEventOutbox).one()
        assert reservation.status == "failed"
        assert reservation.failure_reason == "This charger is no longer available. Refresh status or choose another point."
        assert event.event_type == "reservation.failed"
        assert event.payload["error_type"] == "provider_http_error"
    finally:
        db.close()


def test_provider_timeout_records_unknown_outcome(test_context) -> None:
    client, _, fake_provider, _ = test_context
    fake_provider.failures[("redPlug", "101")] = ProviderServiceError(
        "redPlug",
        "provider_timeout",
        "raw-timeout-detail",
        ambiguous_outcome=True,
    )

    response = client.post("/points/redPlug/101/reservations", headers=ev_headers())

    assert response.status_code == 504
    assert response.json()["detail"]["message"] == reservation_logic.UNKNOWN_OUTCOME_MESSAGE
    assert response.json()["detail"]["outcome_status"] == "unknown"
    assert response.json()["detail"]["retry_allowed"] is False
    assert response.json()["detail"]["reconciliation_required"] is True
    db = get_session_factory()()
    try:
        reservation = db.query(Reservation).one()
        attempt = db.query(ReservationAttempt).one()
        assert reservation.status == "unknown"
        assert attempt.result_status == "unknown"
        assert attempt.provider_called is True
    finally:
        db.close()


def test_unknown_outcome_replays_same_idempotency_result_without_provider_retry(test_context) -> None:
    client, _, fake_provider, _ = test_context
    headers = {**ev_headers(), "Idempotency-Key": "timeout-key-1"}
    fake_provider.failures[("redPlug", "101")] = ProviderServiceError(
        "redPlug",
        "provider_timeout",
        "raw-timeout-detail",
        ambiguous_outcome=True,
    )

    first_response = client.post("/points/redPlug/101/reservations", headers=headers)
    second_response = client.post("/points/redPlug/101/reservations", headers=headers)

    assert first_response.status_code == 504
    assert second_response.status_code == 504
    assert second_response.json()["detail"]["outcome_status"] == "unknown"
    assert second_response.json()["detail"]["retry_allowed"] is False
    assert fake_provider.calls == [("redPlug", "101", 60)]


@pytest.mark.parametrize(
    "reservation_ends_at",
    [
        None,
        "not-a-date",
        "2099-06-12T12:00:00",
        "2000-06-12T12:00:00Z",
    ],
)
def test_invalid_provider_reservation_expiry_creates_unknown_nonbillable_record(test_context, reservation_ends_at) -> None:
    client, _, fake_provider, _ = test_context
    fake_provider.reservations[("redPlug", "101")]["reservation_ends_at"] = reservation_ends_at

    response = client.post(
        "/points/redPlug/101/reservations",
        headers={**ev_headers(), "Idempotency-Key": "invalid-expiry-key"},
    )

    assert response.status_code == 502
    detail = response.json()["detail"]
    assert detail["error_type"] == "invalid_provider_reservation_expiry"
    assert detail["outcome_status"] == "unknown"
    assert detail["retry_allowed"] is False
    db = get_session_factory()()
    try:
        reservation = db.query(Reservation).one()
        attempt = db.query(ReservationAttempt).one()
        idempotency_record = db.query(ReservationIdempotencyRecord).one()
        assert reservation.status == "unknown"
        assert reservation.reservation_ends_at is None
        assert reservation.failure_reason == reservation_logic.UNKNOWN_OUTCOME_MESSAGE
        assert attempt.result_status == "unknown"
        assert attempt.provider_error_type == "invalid_provider_reservation_expiry"
        assert idempotency_record.status == "unknown"
        assert idempotency_record.reservation_id == reservation.id
        assert db.query(ReservationEventOutbox).count() == 0
    finally:
        db.close()


def test_provider_success_then_local_persistence_failure_marks_ambiguous_attempt(test_context, monkeypatch) -> None:
    client, _, fake_provider, _ = test_context

    def fail_after_provider_success(*args, **kwargs):
        raise SQLAlchemyError("simulated local persistence failure")

    monkeypatch.setattr(reservation_logic, "create_successful_reservation", fail_after_provider_success)

    response = client.post(
        "/points/redPlug/101/reservations",
        headers={**ev_headers(), "Idempotency-Key": "persistence-failure-key"},
    )

    assert response.status_code == 500
    assert response.json()["detail"]["error_type"] == "local_persistence_failed_after_provider_success"
    assert response.json()["detail"]["outcome_status"] == "unknown"
    assert response.json()["detail"]["retry_allowed"] is False
    assert fake_provider.calls == [("redPlug", "101", 60)]
    db = get_session_factory()()
    try:
        assert db.query(Reservation).count() == 0
        assert db.query(ReservationEventOutbox).count() == 0
        attempt = db.query(ReservationAttempt).one()
        assert attempt.provider_called is True
        assert attempt.result_status == "unknown"
        assert attempt.provider_error_type == "local_persistence_failed_after_provider_success"
        idempotency_record = db.query(ReservationIdempotencyRecord).one()
        assert idempotency_record.status == "persistence_failed"
    finally:
        db.close()


def test_catalog_unavailable_point_rejects_before_provider_call(test_context) -> None:
    client, _, fake_provider, call_order = test_context

    response = client.post("/points/bluePlug/301/reservations", headers=ev_headers())

    assert response.status_code == 409
    assert fake_provider.calls == []
    assert call_order == ["catalog"]
    db = get_session_factory()()
    try:
        assert db.query(Reservation).count() == 0
        attempt = db.query(ReservationAttempt).one()
        assert attempt.provider_called is False
        assert attempt.provider_error_type == "catalog_point_unavailable"
    finally:
        db.close()


def test_missing_catalog_point_rejects_before_provider_call(test_context) -> None:
    client, fake_catalog, fake_provider, _ = test_context
    fake_catalog.failures[("redPlug", "404")] = CatalogServiceError(
        "redPlug",
        "404",
        "catalog_point_not_found",
        "not found",
        404,
    )

    response = client.post("/points/redPlug/404/reservations", headers=ev_headers())

    assert response.status_code == 404
    assert fake_provider.calls == []
    db = get_session_factory()()
    try:
        assert db.query(Reservation).count() == 0
        assert db.query(ReservationAttempt).one().provider_error_type == "catalog_point_not_found"
    finally:
        db.close()


def test_provider_admin_cannot_create_reservation(test_context) -> None:
    client, _, fake_provider, _ = test_context

    response = client.post("/points/redPlug/101/reservations", headers=red_admin_headers())

    assert response.status_code == 403
    assert fake_provider.calls == []


def test_operator_cannot_create_ev_reservation(test_context) -> None:
    client, _, fake_provider, _ = test_context

    response = client.post("/points/redPlug/101/reservations", headers=operator_headers())

    assert response.status_code == 403
    assert fake_provider.calls == []


def test_unsupported_provider_rejects_before_catalog_or_provider_call(test_context) -> None:
    client, fake_catalog, fake_provider, call_order = test_context

    response = client.post("/points/yellowPlug/101/reservations", headers=ev_headers())

    assert response.status_code == 400
    assert fake_catalog.calls == []
    assert fake_provider.calls == []
    assert call_order == []


def test_my_reservations_only_returns_current_ev_user_records(test_context) -> None:
    client, _, _, _ = test_context
    create_db_reservation("redPlug", "101", "evuser@saasplug.local")
    create_db_reservation("greenPlug", "201", "other@saasplug.local")

    response = client.get("/reservations/me", headers=ev_headers())

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["user_email"] == "evuser@saasplug.local"


def test_provider_admin_reservation_listing_is_scoped_to_own_provider(test_context) -> None:
    client, _, _, _ = test_context
    create_db_reservation("redPlug", "101")
    create_db_reservation("greenPlug", "201")

    response = client.get("/reservations", headers=red_admin_headers())

    assert response.status_code == 200
    payload = response.json()
    assert {reservation["provider_code"] for reservation in payload} == {"redPlug"}
    assert "user_id" not in payload[0]
    assert "user_email" not in payload[0]
    assert "id" not in payload[0]
    assert "provider_reservation_id" not in payload[0]


def test_provider_admin_cannot_read_other_provider_reservation(test_context) -> None:
    client, _, _, _ = test_context
    reservation_id = create_db_reservation("greenPlug", "201")

    response = client.get(f"/reservations/{reservation_id}", headers=red_admin_headers())

    assert response.status_code == 403


def test_operator_provider_filter_rejects_unknown_provider(test_context) -> None:
    client, _, _, _ = test_context
    create_db_reservation("redPlug", "101")

    response = client.get("/reservations?providerCode=yellowPlug", headers=operator_headers())

    assert response.status_code == 400
    assert "Unsupported provider code" in response.json()["detail"]


def test_operator_can_list_all_reservations_attempts_and_outbox(test_context) -> None:
    client, _, _, _ = test_context
    assert client.post("/points/redPlug/101/reservations", headers=ev_headers()).status_code == 201
    assert client.post("/points/greenPlug/201/reservations", headers=ev_headers("other@saasplug.local")).status_code == 201

    reservations_response = client.get("/reservations", headers=operator_headers())
    attempts_response = client.get("/attempts", headers=operator_headers())
    outbox_response = client.get("/events/outbox", headers=operator_headers())

    assert reservations_response.status_code == 200
    assert attempts_response.status_code == 200
    assert outbox_response.status_code == 200
    assert len(reservations_response.json()) == 2
    assert len(attempts_response.json()) == 2
    assert len(outbox_response.json()) == 2
    assert "user_email" in reservations_response.json()[0]
    assert "user_id" in attempts_response.json()[0]


def test_provider_admin_attempt_payload_omits_ev_identifiers(test_context) -> None:
    client, _, _, _ = test_context
    reservation_id = create_db_reservation("redPlug", "101")
    db = get_session_factory()()
    try:
        reservation = db.get(Reservation, reservation_id)
        assert reservation is not None
        db.add(
            ReservationAttempt(
                reservation_id=reservation.id,
                user_id=reservation.user_id,
                user_email=reservation.user_email,
                requested_by_roles=["EV_USER"],
                requested_by_provider_code=None,
                provider_code=reservation.provider_code,
                external_point_id=reservation.external_point_id,
                normalized_point_id=reservation.normalized_point_id,
                requested_duration_minutes=reservation.requested_duration_minutes,
                provider_called=True,
                result_status="succeeded",
                started_at=utcnow(),
                completed_at=utcnow(),
            ),
        )
        db.commit()
    finally:
        db.close()

    response = client.get(f"/reservations/{reservation_id}/attempts", headers=red_admin_headers())

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert "user_id" not in payload[0]
    assert "user_email" not in payload[0]
    assert "requested_by_roles" not in payload[0]
    assert "requested_by_provider_code" not in payload[0]
    assert "reservation_id" not in payload[0]


def test_outbox_row_builds_valid_event_envelope(test_context) -> None:
    client, _, _, _ = test_context
    assert client.post("/points/redPlug/101/reservations", headers=ev_headers()).status_code == 201
    db = get_session_factory()()
    try:
        event = db.query(ReservationEventOutbox).one()
        envelope = outbox_row_to_envelope(event)
        assert str(envelope.event_id) == event.event_id
        assert envelope.event_type == "reservation.succeeded"
        assert envelope.event_version == 1
        assert str(envelope.correlation_id) == event.correlation_id
        assert envelope.producer == "reservation-service"
        assert envelope.payload["reservation_id"] == event.aggregate_id
    finally:
        db.close()


def test_successful_outbox_publish_marks_row_as_published(test_context) -> None:
    client, _, _, _ = test_context
    assert client.post("/points/redPlug/101/reservations", headers=ev_headers()).status_code == 201
    fake_publisher = FakeOutboxPublisher()
    db = get_session_factory()()
    try:
        result = publish_pending_outbox(db, fake_publisher, limit=50)
        event = db.query(ReservationEventOutbox).one()
        assert result.selected_count == 1
        assert result.published_count == 1
        assert result.failed_count == 0
        assert event.publish_status == "published"
        assert event.publish_attempts == 1
        assert event.last_publish_error is None
        assert event.published_at is not None
        assert len(fake_publisher.envelopes) == 1
    finally:
        db.close()


def test_failed_outbox_publish_keeps_row_pending_with_error_metadata(test_context) -> None:
    client, _, _, _ = test_context
    assert client.post("/points/redPlug/101/reservations", headers=ev_headers()).status_code == 201
    fake_publisher = FakeOutboxPublisher(fail=True)
    db = get_session_factory()()
    try:
        result = publish_pending_outbox(db, fake_publisher, limit=50)
        event = db.query(ReservationEventOutbox).one()
        assert result.selected_count == 1
        assert result.published_count == 0
        assert result.failed_count == 1
        assert event.publish_status == "pending"
        assert event.publish_attempts == 1
        assert event.last_publish_error == "publish failed"
        assert event.last_publish_attempt_at is not None
        assert event.published_at is None
    finally:
        db.close()


def test_already_published_outbox_row_is_not_republished(test_context) -> None:
    client, _, _, _ = test_context
    assert client.post("/points/redPlug/101/reservations", headers=ev_headers()).status_code == 201
    db = get_session_factory()()
    try:
        event = db.query(ReservationEventOutbox).one()
        event.publish_status = "published"
        db.commit()
        fake_publisher = FakeOutboxPublisher()
        result = publish_pending_outbox(db, fake_publisher, limit=50)
        assert result.selected_count == 0
        assert result.published_count == 0
        assert len(fake_publisher.envelopes) == 0
    finally:
        db.close()


def test_operator_can_publish_pending_outbox_through_endpoint(test_context, monkeypatch) -> None:
    client, _, _, _ = test_context
    assert client.post("/points/redPlug/101/reservations", headers=ev_headers()).status_code == 201
    fake_publisher = FakeOutboxPublisher()
    monkeypatch.setattr(routes, "build_rabbitmq_publisher", lambda settings: fake_publisher)

    response = client.post("/events/outbox/publish-pending", headers=operator_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["published_count"] == 1
    assert payload["failed_count"] == 0
    assert fake_publisher.closed is True


def test_ev_user_cannot_publish_pending_outbox(test_context, monkeypatch) -> None:
    client, _, _, _ = test_context
    fake_publisher = FakeOutboxPublisher()
    monkeypatch.setattr(routes, "build_rabbitmq_publisher", lambda settings: fake_publisher)

    response = client.post("/events/outbox/publish-pending", headers=ev_headers())

    assert response.status_code == 403
    assert fake_publisher.envelopes == []


def test_ev_user_cannot_list_global_reservations_attempts_or_outbox(test_context) -> None:
    client, _, _, _ = test_context

    reservations_response = client.get("/reservations", headers=ev_headers())
    attempts_response = client.get("/attempts", headers=ev_headers())
    outbox_response = client.get("/events/outbox", headers=ev_headers())

    assert reservations_response.status_code == 403
    assert attempts_response.status_code == 403
    assert outbox_response.status_code == 403


def test_missing_or_invalid_jwt_is_rejected_for_create(test_context) -> None:
    client, _, _, _ = test_context

    missing_response = client.post("/points/redPlug/101/reservations")
    invalid_response = client.post(
        "/points/redPlug/101/reservations",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )

    assert missing_response.status_code == 401
    assert invalid_response.status_code == 401
