import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import routes
from app.client import ProviderClientError, ProviderHttpClient, ProviderHttpResult
from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.main import app
from app.models import ProviderPointSnapshot, ProviderSyncRun, RawProviderPayload
from app.normalization import normalize_point_payload, normalize_status


def sample_point(pointid: int = 201, state: str = "AVAILABLE") -> dict:
    return {
        "id": pointid,
        "providerName": "greenPlug",
        "state": state,
        "reservedUntil": None,
        "kwhRateEur": 0.49,
        "cap": 75,
        "connector": "Type2",
        "locationName": "Green Hub",
        "address": "2 Green Street",
    }


def reservation_payload(pointid: int = 201) -> dict:
    return {
        "id": pointid,
        "providerName": "greenPlug",
        "state": "reserved",
        "reservedUntil": "2026-06-12T13:00:00Z",
        "kwhRateEur": 0.49,
    }


class FakeProviderClient:
    def __init__(self, settings, *, fail_list: bool = False) -> None:
        self.fail_list = fail_list

    def close(self) -> None:
        return None

    def list_points(self) -> ProviderHttpResult:
        if self.fail_list:
            raise ProviderClientError("provider_timeout", "Provider request timed out")
        return ProviderHttpResult([sample_point(), sample_point(202, "charging")], 200, "/chargingPoints")

    def get_point(self, external_point_id: str) -> ProviderHttpResult:
        return ProviderHttpResult(
            sample_point(int(external_point_id)),
            200,
            f"/chargingPoints/{external_point_id}",
        )

    def get_status(self, external_point_id: str) -> ProviderHttpResult:
        return ProviderHttpResult(
            sample_point(int(external_point_id), "reserved"),
            200,
            f"/chargingPoints/{external_point_id}",
        )

    def reserve_point(self, external_point_id: str, duration_minutes: int | None) -> ProviderHttpResult:
        return ProviderHttpResult(
            reservation_payload(int(external_point_id)),
            200,
            f"/chargingPoints/{external_point_id}/reservations",
        )


@pytest.fixture()
def client(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'green-provider-test.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SERVICE_NAME", "green-provider-service")
    monkeypatch.setenv("PROVIDER_CODE", "greenPlug")
    monkeypatch.setenv("PROVIDER_BASE_URL", "https://provider.test/green")
    monkeypatch.setenv("PROVIDER_API_KEY_ENV_VAR", "GREEN_PROVIDER_API_KEY")
    monkeypatch.setenv("GREEN_PROVIDER_API_KEY", "test-secret-not-returned")
    monkeypatch.setenv("PROVIDER_API_TIMEOUT_SECONDS", "2")
    get_settings.cache_clear()
    reset_database_for_tests(database_url)
    monkeypatch.setattr(routes, "ProviderHttpClient", lambda settings: FakeProviderClient(settings))
    with TestClient(app) as test_client:
        yield test_client
    get_settings.cache_clear()


def test_health_endpoint_still_works(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_provider_identity_returns_safe_metadata(client: TestClient) -> None:
    response = client.get("/internal/provider")

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider_code"] == "greenPlug"
    assert payload["api_key_env_var"] == "GREEN_PROVIDER_API_KEY"
    assert "test-secret-not-returned" not in str(payload)


def test_green_point_payload_normalizes_correctly() -> None:
    point = normalize_point_payload(sample_point(state="AVAILABLE"), "greenPlug")

    assert point.external_point_id == "201"
    assert point.normalized_point_id == "greenPlug:201"
    assert point.status == "available"
    assert point.price_per_kwh_eur == 0.49


def test_status_values_normalize_to_internal_enum() -> None:
    assert normalize_status("AVAILABLE") == "available"
    assert normalize_status("reserved") == "reserved"
    assert normalize_status("unexpected-provider-value") == "unknown"


def test_sync_stores_local_snapshots_and_raw_payloads(client: TestClient) -> None:
    response = client.post("/internal/sync")

    assert response.status_code == 200
    assert response.json()["fetched_count"] == 2
    db = get_session_factory()()
    try:
        assert len(db.query(ProviderPointSnapshot).all()) == 2
        assert len(db.query(RawProviderPayload).all()) >= 3
    finally:
        db.close()


def test_failed_sync_records_run_without_deleting_snapshots(client: TestClient, monkeypatch) -> None:
    assert client.post("/internal/sync").status_code == 200
    monkeypatch.setattr(
        routes,
        "ProviderHttpClient",
        lambda settings: FakeProviderClient(settings, fail_list=True),
    )
    failed_response = client.post("/internal/sync")

    assert failed_response.status_code == 502
    db = get_session_factory()()
    try:
        assert len(db.query(ProviderPointSnapshot).all()) == 2
        failed_runs = db.query(ProviderSyncRun).filter(ProviderSyncRun.status == "failed").all()
        assert len(failed_runs) == 1
    finally:
        db.close()


def test_reservation_request_maps_to_green_endpoint_and_normalizes_response(client: TestClient) -> None:
    response = client.post("/internal/points/201/reservations", json={"duration_minutes": 45})

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider_code"] == "greenPlug"
    assert payload["normalized_point_id"] == "greenPlug:201"
    assert payload["status"] == "reserved"
    assert payload["price_per_kwh_eur"] == 0.49


def test_green_http_client_uses_provider_specific_reservation_body(monkeypatch) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = request.read().decode("utf-8")
        captured["authorization"] = request.headers.get("authorization")
        return httpx.Response(200, json=reservation_payload())

    monkeypatch.setenv("PROVIDER_BASE_URL", "https://provider.test")
    monkeypatch.setenv("GREEN_PROVIDER_API_KEY", "secret-value")
    get_settings.cache_clear()
    client = ProviderHttpClient(get_settings(), transport=httpx.MockTransport(handler))
    try:
        result = client.reserve_point("201", 45)
    finally:
        client.close()

    assert captured["path"] == "/chargingPoints/201/reservations"
    assert captured["authorization"] == "Bearer secret-value"
    assert json.loads(captured["body"]) == {"duration": 45}
    assert result.payload["id"] == 201


def test_green_http_client_sends_bearer_auth_on_list_points(monkeypatch) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["authorization"] = request.headers.get("authorization")
        return httpx.Response(200, json=[sample_point()])

    monkeypatch.setenv("PROVIDER_BASE_URL", "https://provider.test")
    monkeypatch.setenv("GREEN_PROVIDER_API_KEY", "secret-value")
    get_settings.cache_clear()
    client = ProviderHttpClient(get_settings(), transport=httpx.MockTransport(handler))
    try:
        result = client.list_points()
    finally:
        client.close()

    assert captured["path"] == "/chargingPoints"
    assert captured["authorization"] == "Bearer secret-value"
    assert result.payload[0]["id"] == 201


def test_green_http_client_rejects_non_json_provider_response(monkeypatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="not-json", headers={"Content-Type": "text/plain"})

    monkeypatch.setenv("PROVIDER_BASE_URL", "https://provider.test")
    monkeypatch.setenv("GREEN_PROVIDER_API_KEY", "secret-value")
    get_settings.cache_clear()
    client = ProviderHttpClient(get_settings(), transport=httpx.MockTransport(handler))
    try:
        with pytest.raises(ProviderClientError) as exc:
            client.list_points()
    finally:
        client.close()

    assert exc.value.error_type == "provider_unexpected_response"
    assert exc.value.external_status_code == 200
