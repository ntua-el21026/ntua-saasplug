from datetime import datetime, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app import routes
from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.main import app
from app.models import CatalogImportRun, CatalogPoint, utcnow
from app.schemas import ProviderPointDTO, ProviderSyncSummaryDTO


def provider_point(
    provider_code: str = "redPlug",
    external_point_id: str = "101",
    status: str = "available",
    location_name: str | None = "Red Hub",
    address: str | None = "1 Red Street",
    connector: str | None = "CCS",
    raw_payload: dict | None = None,
) -> dict:
    return {
        "provider_code": provider_code,
        "external_point_id": external_point_id,
        "normalized_point_id": f"{provider_code}:{external_point_id}",
        "status": status,
        "reservation_ends_at": None,
        "price_per_kwh_eur": 0.42,
        "capacity": 50,
        "connector": connector,
        "location_name": location_name,
        "address": address,
        "raw_payload": raw_payload or {"external_id": external_point_id, "provider": provider_code},
        "last_seen_at": "2026-06-12T10:00:00Z",
    }


class FakeProviderServiceClient:
    def __init__(self) -> None:
        self.points_by_provider = {
            "redPlug": [
                provider_point("redPlug", "101", "available", "Red Hub", "1 Red Street", "CCS"),
                provider_point("redPlug", "102", "charging", "Red Depot", "2 Red Street", "Type2"),
            ],
            "greenPlug": [
                provider_point("greenPlug", "201", "available", "Green Hub", "1 Green Street", "CCS"),
            ],
            "bluePlug": [
                provider_point("bluePlug", "301", "reserved", "Blue Hub", "1 Blue Street", "CHAdeMO"),
            ],
        }

    def close(self) -> None:
        return None

    def sync_provider(self, provider_code: str) -> ProviderSyncSummaryDTO:
        return ProviderSyncSummaryDTO(
            provider_code=provider_code,
            status="completed",
            fetched_count=len(self.points_by_provider[provider_code]),
            upserted_count=len(self.points_by_provider[provider_code]),
            failed_count=0,
        )

    def list_points(self, provider_code: str) -> list[ProviderPointDTO]:
        return [ProviderPointDTO.model_validate(point) for point in self.points_by_provider[provider_code]]

    def get_provider(self, provider_code: str) -> dict:
        return {"provider_code": provider_code}


def access_token(roles: list[str], email: str, provider_code: str | None = None) -> str:
    return jwt.encode(
        {
            "sub": f"user-{email}",
            "email": email,
            "roles": roles,
            "provider_id": provider_code,
            "provider_code": provider_code,
        },
        "catalog-test-secret",
        algorithm="HS256",
    )


def auth_headers(roles: list[str], email: str, provider_code: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token(roles, email, provider_code)}"}


@pytest.fixture()
def test_context(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'catalog-test.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("SERVICE_NAME", "catalog-service")
    monkeypatch.setenv("JWT_SECRET", "catalog-test-secret")
    monkeypatch.setenv("CATALOG_PROVIDER_HTTP_TIMEOUT_SECONDS", "2")
    monkeypatch.setenv("SCHEDULER_INTERNAL_TOKEN", "scheduler-test-token")
    get_settings.cache_clear()
    reset_database_for_tests(database_url)
    fake_client = FakeProviderServiceClient()
    monkeypatch.setattr(routes, "ProviderServiceClient", lambda settings: fake_client)
    with TestClient(app) as test_client:
        yield test_client, fake_client
    get_settings.cache_clear()


def import_red(client: TestClient) -> None:
    response = client.post(
        "/imports/providers/redPlug",
        headers=auth_headers(["OPERATOR"], "operator@saasplug.local"),
    )
    assert response.status_code == 200


def scheduler_headers() -> dict[str, str]:
    return {"X-Scheduler-Token": "scheduler-test-token", "X-Job-Run-Id": "scheduler-run-1"}


def test_health_endpoint_still_works(test_context) -> None:
    client, _ = test_context

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_operator_can_import_one_provider_from_fake_provider_service(test_context) -> None:
    client, _ = test_context

    response = client.post(
        "/imports/providers/redPlug",
        headers=auth_headers(["OPERATOR"], "operator@saasplug.local"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider_code"] == "redPlug"
    assert payload["status"] == "completed"
    assert payload["catalog_upserted_count"] == 2


def test_scheduler_internal_import_requires_scheduler_token(test_context) -> None:
    client, _ = test_context

    response = client.post("/internal/jobs/catalog/imports/providers/redPlug")

    assert response.status_code == 401


def test_scheduler_internal_import_uses_service_owned_importer(test_context) -> None:
    client, _ = test_context

    response = client.post("/internal/jobs/catalog/imports/providers/redPlug", headers=scheduler_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["catalog_upserted_count"] == 2
    db = get_session_factory()()
    try:
        import_run = db.query(CatalogImportRun).one()
        assert import_run.triggered_by == "scheduler-service"
    finally:
        db.close()


def test_repeated_import_upserts_without_duplicates(test_context) -> None:
    client, _ = test_context

    import_red(client)
    import_red(client)

    db = get_session_factory()()
    try:
        assert db.query(CatalogPoint).count() == 2
        assert db.query(CatalogImportRun).count() == 2
    finally:
        db.close()


def test_missing_points_from_latest_import_are_stale_and_inactive(test_context) -> None:
    client, fake_client = test_context
    import_red(client)
    fake_client.points_by_provider["redPlug"] = [
        provider_point("redPlug", "101", "available", "Red Hub", "1 Red Street", "CCS"),
    ]

    response = client.post(
        "/imports/providers/redPlug",
        headers=auth_headers(["OPERATOR"], "operator@saasplug.local"),
    )

    assert response.status_code == 200
    assert response.json()["catalog_marked_stale_count"] == 1
    db = get_session_factory()()
    try:
        stale_point = (
            db.query(CatalogPoint)
            .filter(CatalogPoint.provider_code == "redPlug", CatalogPoint.external_point_id == "102")
            .one()
        )
        assert stale_point.is_active is False
        assert stale_point.is_stale is True
    finally:
        db.close()


def test_points_endpoint_supports_provider_status_and_search_filters(test_context) -> None:
    client, _ = test_context
    import_red(client)

    response = client.get("/points?providerCode=redPlug&status=available&q=Red%20Hub")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["external_point_id"] == "101"
    assert payload["items"][0]["coordinate_source"] == "demo_synthetic"


def test_points_endpoint_supports_bounds_and_excludes_coordinate_less_points(test_context) -> None:
    client, _ = test_context
    import_red(client)
    db = get_session_factory()()
    try:
        db.add(
            CatalogPoint(
                normalized_point_id="redPlug:missing-coordinates",
                provider_code="redPlug",
                external_point_id="missing-coordinates",
                display_name="Missing Coordinates",
                location_name="Missing Coordinates",
                address="Unknown",
                latitude=None,
                longitude=None,
                coordinate_source="missing",
                status="available",
                is_active=True,
                is_stale=False,
                last_provider_seen_at=datetime.now(timezone.utc),
                last_catalog_sync_at=utcnow(),
                raw_provider_payload={"external_id": "missing-coordinates"},
            ),
        )
        db.commit()
    finally:
        db.close()

    response = client.get("/points?minLat=37.0&maxLat=39.0&minLng=23.0&maxLng=24.5")

    assert response.status_code == 200
    payload = response.json()
    external_ids = {item["external_point_id"] for item in payload["items"]}
    assert "101" in external_ids
    assert "missing-coordinates" not in external_ids
    assert payload["bounds_applied"] is True
    assert payload["missing_coordinates_count"] == 1


def test_cached_point_details_are_returned_without_live_provider_call(test_context) -> None:
    client, _ = test_context
    import_red(client)

    response = client.get("/points/redPlug/101")

    assert response.status_code == 200
    payload = response.json()
    assert payload["normalized_point_id"] == "redPlug:101"
    assert payload["raw_provider_payload"]["external_id"] == "101"


def test_provider_admin_cannot_trigger_imports(test_context) -> None:
    client, _ = test_context

    response = client.post(
        "/imports/providers/redPlug",
        headers=auth_headers(["PROVIDER_ADMIN"], "red-admin@saasplug.local", "redPlug"),
    )

    assert response.status_code == 403


def test_provider_admin_import_run_listing_is_scoped(test_context) -> None:
    client, _ = test_context
    import_red(client)
    green_response = client.post(
        "/imports/providers/greenPlug",
        headers=auth_headers(["OPERATOR"], "operator@saasplug.local"),
    )
    assert green_response.status_code == 200

    response = client.get(
        "/imports/runs",
        headers=auth_headers(["PROVIDER_ADMIN"], "red-admin@saasplug.local", "redPlug"),
    )

    assert response.status_code == 200
    provider_codes = {run["provider_code"] for run in response.json()}
    assert provider_codes == {"redPlug"}


def test_ev_user_cannot_access_import_runs(test_context) -> None:
    client, _ = test_context
    import_red(client)

    response = client.get(
        "/imports/runs",
        headers=auth_headers(["EV_USER"], "evuser@saasplug.local"),
    )

    assert response.status_code == 403


def test_imports_all_returns_per_provider_summary(test_context) -> None:
    client, _ = test_context

    response = client.post(
        "/imports/all",
        headers=auth_headers(["OPERATOR"], "operator@saasplug.local"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert {summary["provider_code"] for summary in payload["providers"]} == {
        "redPlug",
        "greenPlug",
        "bluePlug",
    }


def test_raw_payloads_are_stored_without_exposing_secret_values(test_context) -> None:
    client, fake_client = test_context
    fake_client.points_by_provider["redPlug"] = [
        provider_point(
            "redPlug",
            "101",
            raw_payload={
                "external_id": "101",
                "api_key": "provider-secret-value",
                "nested": {"authorization": "Bearer provider-secret-value"},
            },
        ),
    ]

    import_red(client)
    detail_response = client.get("/points/redPlug/101")

    assert detail_response.status_code == 200
    assert "provider-secret-value" not in str(detail_response.json())
    db = get_session_factory()()
    try:
        point = db.query(CatalogPoint).filter(CatalogPoint.external_point_id == "101").one()
        assert "provider-secret-value" not in str(point.raw_provider_payload)
        assert point.raw_provider_payload["api_key"] == "[redacted]"
    finally:
        db.close()
