import httpx
import pytest
from fastapi.testclient import TestClient

from app.client import ProviderClientError, ProviderHttpClient, ProviderHttpResult
from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.main import app
from app.models import ProviderPointSnapshot, ProviderSyncRun, RawProviderPayload
from app.normalization import normalize_point_payload, normalize_status
from app import routes


def sample_point(pointid: int = 101, status: str = "AVAILABLE") -> dict:
    return {
        "pointid": pointid,
        "providerName": "redPlug",
        "status": status,
        "reservationendtime": None,
        "cap": 50,
        "connector": "CCS",
        "locationName": "Red Hub",
        "address": "1 Red Street",
    }


def reservation_payload(pointid: int = 101) -> dict:
    return {
        "pointid": pointid,
        "providerName": "redPlug",
        "status": "reserved",
        "reservationendtime": "2026-06-12T12:00:00Z",
    }


class FakeProviderClient:
    def __init__(self, settings, *, fail_list: bool = False) -> None:
        self.fail_list = fail_list

    def close(self) -> None:
        return None

    def list_points(self) -> ProviderHttpResult:
        if self.fail_list:
            raise ProviderClientError("provider_timeout", "Provider request timed out")
        return ProviderHttpResult([sample_point(), sample_point(102, "charging")], 200, "/points")

    def get_point(self, external_point_id: str) -> ProviderHttpResult:
        return ProviderHttpResult(sample_point(int(external_point_id)), 200, f"/point/{external_point_id}")

    def get_status(self, external_point_id: str) -> ProviderHttpResult:
        return ProviderHttpResult(sample_point(int(external_point_id), "reserved"), 200, f"/point/{external_point_id}")

    def reserve_point(self, external_point_id: str, duration_minutes: int | None) -> ProviderHttpResult:
        return ProviderHttpResult(
            reservation_payload(int(external_point_id)),
            200,
            f"/reserve/{external_point_id}/{duration_minutes or 60}",
        )


@pytest.fixture()
def client(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'red-provider-test.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SERVICE_NAME", "red-provider-service")
    monkeypatch.setenv("PROVIDER_CODE", "redPlug")
    monkeypatch.setenv("PROVIDER_BASE_URL", "https://provider.test/red")
    monkeypatch.setenv("PROVIDER_API_KEY_ENV_VAR", "RED_PROVIDER_API_KEY")
    monkeypatch.setenv("RED_PROVIDER_API_KEY", "test-secret-not-returned")
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
    assert payload["provider_code"] == "redPlug"
    assert payload["api_key_env_var"] == "RED_PROVIDER_API_KEY"
    assert "test-secret-not-returned" not in str(payload)


def test_red_point_payload_normalizes_correctly() -> None:
    point = normalize_point_payload(sample_point(status="AVAILABLE"), "redPlug")

    assert point.external_point_id == "101"
    assert point.normalized_point_id == "redPlug:101"
    assert point.status == "available"
    assert point.reservation_ends_at is None
    assert point.price_per_kwh_eur is None


def test_status_values_normalize_to_internal_enum() -> None:
    assert normalize_status("AVAILABLE") == "available"
    assert normalize_status("charging") == "charging"
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


def test_reservation_request_maps_to_red_endpoint_and_normalizes_response(client: TestClient) -> None:
    response = client.post("/internal/points/101/reservations", json={"duration_minutes": 45})

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider_code"] == "redPlug"
    assert payload["normalized_point_id"] == "redPlug:101"
    assert payload["status"] == "reserved"
    assert payload["reservation_ends_at"] == "2026-06-12T12:00:00Z"


def test_red_http_client_uses_provider_specific_reservation_path(monkeypatch) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["authorization"] = request.headers.get("authorization")
        return httpx.Response(200, json=reservation_payload())

    monkeypatch.setenv("PROVIDER_BASE_URL", "https://provider.test")
    monkeypatch.setenv("RED_PROVIDER_API_KEY", "secret-value")
    get_settings.cache_clear()
    client = ProviderHttpClient(get_settings(), transport=httpx.MockTransport(handler))
    try:
        result = client.reserve_point("101", 45)
    finally:
        client.close()

    assert captured["path"] == "/reserve/101/45"
    assert captured["authorization"] == "Bearer secret-value"
    assert result.payload["pointid"] == 101
