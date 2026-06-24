import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from app import routes
from app import event_publisher
from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.main import app
from app.models import StatusCache, StatusCachePolicy, StatusCheckLog, utcnow
from app.provider_client import ProviderServiceError
from app.schemas import ProviderStatusDTO
from saasplug_events.routing import EventType


class FakeEventPublisher:
    def __init__(self) -> None:
        self.envelopes = []
        self.closed = False

    def publish(self, envelope) -> None:
        self.envelopes.append(envelope)

    def close(self) -> None:
        self.closed = True


def provider_status(
    provider_code: str = "redPlug",
    external_point_id: str = "101",
    status: str = "available",
) -> dict:
    return {
        "provider_code": provider_code,
        "external_point_id": external_point_id,
        "normalized_point_id": f"{provider_code}:{external_point_id}",
        "status": status,
        "reservation_ends_at": None,
        "checked_at": "2026-06-12T10:00:00Z",
    }


class FakeProviderServiceClient:
    def __init__(self) -> None:
        self.statuses = {
            ("redPlug", "101"): provider_status("redPlug", "101", "available"),
            ("redPlug", "102"): provider_status("redPlug", "102", "charging"),
            ("greenPlug", "201"): provider_status("greenPlug", "201", "reserved"),
        }
        self.failures: dict[tuple[str, str], ProviderServiceError] = {}
        self.calls: list[tuple[str, str]] = []
        self.delay_seconds = 0.0
        self.call_lock = threading.Lock()

    def close(self) -> None:
        return None

    def get_status(self, provider_code: str, external_point_id: str) -> ProviderStatusDTO:
        with self.call_lock:
            self.calls.append((provider_code, external_point_id))
        if self.delay_seconds:
            time.sleep(self.delay_seconds)
        failure = self.failures.get((provider_code, external_point_id))
        if failure is not None:
            raise failure
        return ProviderStatusDTO.model_validate(self.statuses[(provider_code, external_point_id)])


def access_token(roles: list[str], email: str, provider_code: str | None = None) -> str:
    return jwt.encode(
        {
            "sub": f"user-{email}",
            "email": email,
            "roles": roles,
            "provider_id": provider_code,
            "provider_code": provider_code,
        },
        "status-test-secret",
        algorithm="HS256",
    )


def auth_headers(roles: list[str], email: str, provider_code: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token(roles, email, provider_code)}"}


@pytest.fixture()
def test_context(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'status-test.db'}"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("SAASPLUG_STRICT_SECRETS", "false")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SERVICE_NAME", "status-service")
    monkeypatch.setenv("JWT_SECRET", "status-test-secret")
    monkeypatch.setenv("STATUS_CACHE_TTL_SECONDS", "300")
    monkeypatch.setenv("STATUS_PROVIDER_TIMEOUT_SECONDS", "2")
    monkeypatch.setenv("STATUS_RABBITMQ_EVENT_PUBLISH_ENABLED", "false")
    get_settings.cache_clear()
    reset_database_for_tests(database_url)
    fake_client = FakeProviderServiceClient()
    monkeypatch.setattr(routes, "ProviderServiceClient", lambda settings: fake_client)
    with TestClient(app) as test_client:
        yield test_client, fake_client
    get_settings.cache_clear()


def operator_headers() -> dict[str, str]:
    return auth_headers(["OPERATOR"], "operator@saasplug.local")


def ev_headers() -> dict[str, str]:
    return auth_headers(["EV_USER"], "evuser@saasplug.local")


def red_admin_headers() -> dict[str, str]:
    return auth_headers(["PROVIDER_ADMIN"], "red-admin@saasplug.local", "redPlug")


def enable_fake_event_publisher(monkeypatch) -> FakeEventPublisher:
    fake_publisher = FakeEventPublisher()
    get_settings().rabbitmq_event_publish_enabled = True
    monkeypatch.setattr(event_publisher, "build_event_publisher", lambda settings: fake_publisher)
    return fake_publisher


def test_health_endpoint_still_works(test_context) -> None:
    client, _ = test_context

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_first_lookup_calls_provider_and_stores_cache(test_context) -> None:
    client, fake_client = test_context

    response = client.get("/points/redPlug/101/status", headers=ev_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "available"
    assert payload["cache_hit"] is False
    assert payload["provider_called"] is True
    assert fake_client.calls == [("redPlug", "101")]
    db = get_session_factory()()
    try:
        assert db.query(StatusCache).count() == 1
        assert db.query(StatusCheckLog).count() == 1
    finally:
        db.close()


def test_status_lookup_scopes_provider_admins_but_allows_ev_and_operator(test_context) -> None:
    client, fake_client = test_context

    ev_response = client.get("/points/greenPlug/201/status", headers=ev_headers())
    operator_response = client.get("/points/greenPlug/201/status?forceRefresh=true", headers=operator_headers())
    own_provider_response = client.get("/points/redPlug/101/status", headers=red_admin_headers())
    other_provider_response = client.get("/points/greenPlug/201/status", headers=red_admin_headers())

    assert ev_response.status_code == 200
    assert operator_response.status_code == 200
    assert own_provider_response.status_code == 200
    assert other_provider_response.status_code == 403
    assert ("greenPlug", "201") in fake_client.calls
    assert ("redPlug", "101") in fake_client.calls


def test_status_cache_read_scopes_provider_admins(test_context) -> None:
    client, _ = test_context
    assert client.get("/points/redPlug/101/status", headers=operator_headers()).status_code == 200
    assert client.get("/points/greenPlug/201/status", headers=operator_headers()).status_code == 200

    own_cache_response = client.get("/cache/redPlug/101", headers=red_admin_headers())
    other_cache_response = client.get("/cache/greenPlug/201", headers=red_admin_headers())

    assert own_cache_response.status_code == 200
    assert other_cache_response.status_code == 403


def test_status_lookup_publishes_status_checked_event(test_context, monkeypatch) -> None:
    client, _ = test_context
    fake_publisher = enable_fake_event_publisher(monkeypatch)

    response = client.get("/points/redPlug/101/status", headers=ev_headers())

    assert response.status_code == 200
    assert len(fake_publisher.envelopes) == 1
    envelope = fake_publisher.envelopes[0]
    assert envelope.event_type == EventType.STATUS_POINT_CHECKED.value
    assert envelope.producer == "status-service"
    assert envelope.payload["provider_code"] == "redPlug"
    assert envelope.payload["external_point_id"] == "101"
    assert envelope.payload["status"] == "available"
    assert envelope.payload["provider_called"] is True
    assert envelope.payload["user_id"] == "user-evuser@saasplug.local"


def test_second_lookup_within_ttl_returns_cache_without_provider_call(test_context) -> None:
    client, fake_client = test_context
    assert client.get("/points/redPlug/101/status", headers=ev_headers()).status_code == 200
    fake_client.statuses[("redPlug", "101")] = provider_status("redPlug", "101", "charging")

    response = client.get("/points/redPlug/101/status", headers=ev_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "available"
    assert payload["cache_hit"] is True
    assert payload["provider_called"] is False
    assert fake_client.calls == [("redPlug", "101")]


def test_operator_cache_policy_changes_existing_cache_expiry_immediately(test_context) -> None:
    client, fake_client = test_context
    assert client.get("/points/redPlug/101/status", headers=ev_headers()).status_code == 200

    denied = client.patch("/cache/policy", headers=ev_headers(), json={"ttl_seconds": 30})
    updated = client.patch("/cache/policy", headers=operator_headers(), json={"ttl_seconds": 30})

    assert denied.status_code == 403
    assert updated.status_code == 200
    assert updated.json()["ttl_seconds"] == 30
    db = get_session_factory()()
    try:
        policy = db.get(StatusCachePolicy, "default")
        cache = db.query(StatusCache).one()
        assert policy is not None
        assert policy.ttl_seconds == 30
        assert cache.expires_at - cache.last_checked_at == timedelta(seconds=30)
        cache.last_checked_at = utcnow() - timedelta(seconds=31)
        cache.expires_at = cache.last_checked_at + timedelta(seconds=30)
        db.commit()
    finally:
        db.close()

    fake_client.statuses[("redPlug", "101")] = provider_status("redPlug", "101", "reserved")
    refreshed = client.get("/points/redPlug/101/status", headers=ev_headers())
    reset = client.patch("/cache/policy", headers=operator_headers(), json={"ttl_seconds": 300})

    assert refreshed.status_code == 200
    assert refreshed.json()["status"] == "reserved"
    assert fake_client.calls == [("redPlug", "101"), ("redPlug", "101")]
    assert reset.status_code == 200
    assert reset.json()["ttl_seconds"] == 300


def test_expired_cache_triggers_provider_refresh(test_context) -> None:
    client, fake_client = test_context
    assert client.get("/points/redPlug/101/status", headers=ev_headers()).status_code == 200
    db = get_session_factory()()
    try:
        cache = db.query(StatusCache).one()
        cache.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()
    fake_client.statuses[("redPlug", "101")] = provider_status("redPlug", "101", "charging")

    response = client.get("/points/redPlug/101/status", headers=ev_headers())

    assert response.status_code == 200
    assert response.json()["status"] == "charging"
    assert fake_client.calls == [("redPlug", "101"), ("redPlug", "101")]


def test_expired_cache_concurrent_same_point_uses_single_provider_refresh(test_context) -> None:
    client, fake_client = test_context
    assert client.get("/points/redPlug/101/status", headers=ev_headers()).status_code == 200
    db = get_session_factory()()
    try:
        cache = db.query(StatusCache).one()
        cache.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()
    fake_client.calls.clear()
    fake_client.delay_seconds = 0.05
    fake_client.statuses[("redPlug", "101")] = provider_status("redPlug", "101", "charging")

    def read_status():
        return client.get("/points/redPlug/101/status", headers=ev_headers())

    with ThreadPoolExecutor(max_workers=5) as executor:
        responses = list(executor.map(lambda _: read_status(), range(5)))

    assert all(response.status_code == 200 for response in responses)
    assert {response.json()["status"] for response in responses} == {"charging"}
    assert fake_client.calls == [("redPlug", "101")]


def test_concurrent_different_points_refresh_independently(test_context) -> None:
    client, fake_client = test_context
    fake_client.delay_seconds = 0.05

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(
            executor.map(
                lambda path: client.get(path, headers=ev_headers()),
                ["/points/redPlug/101/status", "/points/redPlug/102/status"],
            ),
        )

    assert all(response.status_code == 200 for response in responses)
    assert sorted(fake_client.calls) == [("redPlug", "101"), ("redPlug", "102")]


def test_force_refresh_bypasses_valid_cache(test_context) -> None:
    client, fake_client = test_context
    assert client.get("/points/redPlug/101/status", headers=ev_headers()).status_code == 200
    fake_client.statuses[("redPlug", "101")] = provider_status("redPlug", "101", "reserved")

    response = client.get("/points/redPlug/101/status?forceRefresh=true", headers=ev_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "reserved"
    assert payload["cache_hit"] is False
    assert payload["provider_called"] is True
    assert fake_client.calls == [("redPlug", "101"), ("redPlug", "101")]


def test_provider_unexpected_status_is_cached_as_unknown(test_context) -> None:
    client, fake_client = test_context
    fake_client.statuses[("redPlug", "101")] = provider_status("redPlug", "101", "provider-specific-surprise")

    response = client.get("/points/redPlug/101/status", headers=ev_headers())

    assert response.status_code == 200
    assert response.json()["status"] == "unknown"
    db = get_session_factory()()
    try:
        cache = db.query(StatusCache).one()
        assert cache.status == "unknown"
    finally:
        db.close()


def test_provider_failure_with_previous_cache_returns_stale_fallback(test_context) -> None:
    client, fake_client = test_context
    assert client.get("/points/redPlug/101/status", headers=ev_headers()).status_code == 200
    fake_client.failures[("redPlug", "101")] = ProviderServiceError(
        "redPlug",
        "provider_timeout",
        "Provider service timed out",
    )

    response = client.get("/points/redPlug/101/status?forceRefresh=true", headers=ev_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "available"
    assert payload["returned_stale"] is True
    assert payload["source"] == "cache_fallback"
    assert payload["warning"] is not None


def test_provider_failure_without_cache_returns_normalized_502(test_context) -> None:
    client, fake_client = test_context
    fake_client.failures[("redPlug", "101")] = ProviderServiceError(
        "redPlug",
        "provider_http_error",
        "Provider returned an HTTP error",
        status_code=502,
        external_status_code=403,
    )

    response = client.get("/points/redPlug/101/status", headers=ev_headers())

    assert response.status_code == 502
    assert response.json()["detail"]["error_type"] == "provider_http_error"
    db = get_session_factory()()
    try:
        log = db.query(StatusCheckLog).one()
        assert log.provider_error_type == "provider_http_error"
        assert log.external_status_code == 403
    finally:
        db.close()


def test_status_lookup_failure_publishes_status_checked_error_event(test_context, monkeypatch) -> None:
    client, fake_client = test_context
    fake_client.failures[("redPlug", "101")] = ProviderServiceError(
        "redPlug",
        "provider_http_error",
        "Provider returned an HTTP error",
        status_code=502,
        external_status_code=403,
    )
    fake_publisher = enable_fake_event_publisher(monkeypatch)

    response = client.get("/points/redPlug/101/status", headers=ev_headers())

    assert response.status_code == 502
    assert len(fake_publisher.envelopes) == 1
    envelope = fake_publisher.envelopes[0]
    assert envelope.event_type == EventType.STATUS_POINT_CHECKED.value
    assert envelope.payload["status"] == "unknown"
    assert envelope.payload["source"] == "provider_error"
    assert envelope.payload["error_type"] == "provider_http_error"


def test_provider_response_with_wrong_provider_code_returns_502_without_cache(test_context) -> None:
    client, fake_client = test_context
    fake_client.statuses[("redPlug", "101")] = provider_status("greenPlug", "101", "available")

    response = client.get("/points/redPlug/101/status", headers=ev_headers())

    assert response.status_code == 502
    assert response.json()["detail"]["error_type"] == "provider_invalid_response"
    db = get_session_factory()()
    try:
        assert db.query(StatusCache).count() == 0
        log = db.query(StatusCheckLog).one()
        assert log.provider_error_type == "provider_invalid_response"
        assert log.result_status is None
    finally:
        db.close()


def test_provider_response_with_wrong_normalized_id_returns_stale_fallback(test_context) -> None:
    client, fake_client = test_context
    assert client.get("/points/redPlug/101/status", headers=ev_headers()).status_code == 200
    fake_client.statuses[("redPlug", "101")] = {
        **provider_status("redPlug", "101", "charging"),
        "normalized_point_id": "redPlug:other-point",
    }

    response = client.get("/points/redPlug/101/status?forceRefresh=true", headers=ev_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "available"
    assert payload["returned_stale"] is True
    assert payload["source"] == "cache_fallback"
    db = get_session_factory()()
    try:
        cache = db.query(StatusCache).one()
        assert cache.last_error_type == "provider_invalid_response"
    finally:
        db.close()


def test_provider_admin_log_access_is_scoped_to_own_provider(test_context) -> None:
    client, _ = test_context
    assert client.get("/points/redPlug/101/status", headers=operator_headers()).status_code == 200
    assert client.get("/points/greenPlug/201/status", headers=operator_headers()).status_code == 200

    response = client.get(
        "/logs",
        headers=auth_headers(["PROVIDER_ADMIN"], "red-admin@saasplug.local", "redPlug"),
    )

    assert response.status_code == 200
    logs = response.json()
    provider_codes = {log["provider_code"] for log in logs}
    assert provider_codes == {"redPlug"}
    assert "requested_by_user_id" not in logs[0]
    assert "requested_by_email" not in logs[0]
    assert "requested_by_roles" not in logs[0]
    assert "requested_by_provider_code" not in logs[0]

    operator_response = client.get("/logs", headers=operator_headers())
    assert operator_response.status_code == 200
    operator_log = operator_response.json()[0]
    assert "requested_by_user_id" in operator_log
    assert "requested_by_email" in operator_log


def test_ev_user_cannot_list_logs(test_context) -> None:
    client, _ = test_context
    assert client.get("/points/redPlug/101/status", headers=ev_headers()).status_code == 200

    response = client.get("/logs", headers=ev_headers())

    assert response.status_code == 403


def test_unknown_provider_code_returns_client_error(test_context) -> None:
    client, _ = test_context

    response = client.get("/points/yellowPlug/101/status", headers=ev_headers())

    assert response.status_code == 400


def test_missing_or_invalid_jwt_is_rejected_for_status_lookup(test_context) -> None:
    client, _ = test_context

    missing_response = client.get("/points/redPlug/101/status")
    invalid_response = client.get(
        "/points/redPlug/101/status",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )

    assert missing_response.status_code == 401
    assert invalid_response.status_code == 401


def test_freshness_endpoint_returns_provider_level_metadata(test_context) -> None:
    client, _ = test_context
    assert client.get("/points/redPlug/101/status", headers=ev_headers()).status_code == 200

    response = client.get("/freshness")

    assert response.status_code == 200
    payload = response.json()
    assert {item["provider_code"] for item in payload} == {"redPlug", "greenPlug", "bluePlug"}
    red_freshness = next(item for item in payload if item["provider_code"] == "redPlug")
    assert red_freshness["cached_count"] == 1
    assert red_freshness["valid_cache_count"] == 1
