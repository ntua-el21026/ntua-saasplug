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


def sample_point(pointid: int = 301, current_status: str = "AVAILABLE") -> dict:
    return {
        "chargerId": pointid,
        "providerName": "bluePlug",
        "currentStatus": current_status,
        "reservationEnd": None,
        "pricePerKwh": 0.59,
        "cap": 150,
        "connector": "CCS",
        "locationName": "Blue Hub",
        "address": "3 Blue Street",
    }


def reservation_payload(pointid: int = 301) -> dict:
    return {
        "chargerId": pointid,
        "providerName": "bluePlug",
        "currentStatus": "reserved",
        "reservationEnd": "2026-06-12T14:00:00Z",
        "pricePerKwh": 0.59,
    }


class FakeProviderClient:
    def __init__(self, settings, *, fail_list: bool = False) -> None:
        self.fail_list = fail_list

    def close(self) -> None:
        return None

    def list_points(self) -> ProviderHttpResult:
        if self.fail_list:
            raise ProviderClientError("provider_timeout", "Provider request timed out")
        return ProviderHttpResult([sample_point(), sample_point(302, "charging")], 200, "/locations")

    def get_point(self, external_point_id: str) -> ProviderHttpResult:
        return ProviderHttpResult(
            sample_point(int(external_point_id)),
            200,
            f"/location/{external_point_id}/status",
        )

    def get_status(self, external_point_id: str) -> ProviderHttpResult:
        return ProviderHttpResult(
            sample_point(int(external_point_id), "reserved"),
            200,
            f"/location/{external_point_id}/status",
        )

    def reserve_point(self, external_point_id: str, duration_minutes: int | None) -> ProviderHttpResult:
        return ProviderHttpResult(
            reservation_payload(int(external_point_id)),
            200,
            f"/location/{external_point_id}/hold",
        )


@pytest.fixture()
def client(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'blue-provider-test.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SERVICE_NAME", "blue-provider-service")
    monkeypatch.setenv("PROVIDER_CODE", "bluePlug")
    monkeypatch.setenv("PROVIDER_BASE_URL", "https://provider.test/blue")
    monkeypatch.setenv("PROVIDER_API_KEY_ENV_VAR", "BLUE_PROVIDER_API_KEY")
    monkeypatch.setenv("BLUE_PROVIDER_API_KEY", "test-secret-not-returned")
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
    assert payload["provider_code"] == "bluePlug"
    assert payload["api_key_env_var"] == "BLUE_PROVIDER_API_KEY"
    assert "test-secret-not-returned" not in str(payload)


def test_blue_point_payload_normalizes_correctly() -> None:
    point = normalize_point_payload(sample_point(current_status="AVAILABLE"), "bluePlug")

    assert point.external_point_id == "301"
    assert point.normalized_point_id == "bluePlug:301"
    assert point.status == "available"
    assert point.price_per_kwh_eur == 0.59


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


def test_reservation_request_maps_to_blue_endpoint_and_normalizes_response(client: TestClient) -> None:
    response = client.post("/internal/points/301/reservations", json={"duration_minutes": 45})

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider_code"] == "bluePlug"
    assert payload["normalized_point_id"] == "bluePlug:301"
    assert payload["status"] == "reserved"
    assert payload["price_per_kwh_eur"] == 0.59


def test_blue_http_client_uses_provider_specific_reservation_query(monkeypatch) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["query"] = request.url.query.decode("utf-8")
        captured["authorization"] = request.headers.get("authorization")
        return httpx.Response(200, json=reservation_payload())

    monkeypatch.setenv("PROVIDER_BASE_URL", "https://provider.test")
    monkeypatch.setenv("BLUE_PROVIDER_API_KEY", "secret-value")
    get_settings.cache_clear()
    client = ProviderHttpClient(get_settings(), transport=httpx.MockTransport(handler))
    try:
        result = client.reserve_point("301", 45)
    finally:
        client.close()

    assert captured["path"] == "/location/301/hold"
    assert captured["authorization"] == "Bearer secret-value"
    assert captured["query"] == "minutes=45"
    assert result.payload["chargerId"] == 301


def test_blue_http_client_sends_bearer_auth_on_list_points(monkeypatch) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["authorization"] = request.headers.get("authorization")
        return httpx.Response(200, json=[sample_point()])

    monkeypatch.setenv("PROVIDER_BASE_URL", "https://provider.test")
    monkeypatch.setenv("BLUE_PROVIDER_API_KEY", "secret-value")
    get_settings.cache_clear()
    client = ProviderHttpClient(get_settings(), transport=httpx.MockTransport(handler))
    try:
        result = client.list_points()
    finally:
        client.close()

    assert captured["path"] == "/locations"
    assert captured["authorization"] == "Bearer secret-value"
    assert result.payload[0]["chargerId"] == 301


def test_blue_http_client_maps_connect_error_to_provider_unavailable(monkeypatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("provider offline")

    monkeypatch.setenv("PROVIDER_BASE_URL", "https://provider.test")
    monkeypatch.setenv("BLUE_PROVIDER_API_KEY", "secret-value")
    get_settings.cache_clear()
    client = ProviderHttpClient(get_settings(), transport=httpx.MockTransport(handler))
    try:
        with pytest.raises(ProviderClientError) as exc:
            client.list_points()
    finally:
        client.close()

    assert exc.value.error_type == "provider_unavailable"
    assert exc.value.external_status_code is None
