from datetime import datetime, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app import routes
from app import event_publisher
from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.importer import synthetic_coordinates
from app.main import app
from app.models import CatalogImportRun, CatalogPoint, utcnow
from app.schemas import ProviderPointDTO, ProviderSyncSummaryDTO
from saasplug_events.routing import EventType


class FakeEventPublisher:
    def __init__(self) -> None:
        self.envelopes = []
        self.closed = False

    def publish(self, envelope) -> None:
        self.envelopes.append(envelope)

    def close(self) -> None:
        self.closed = True


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
    monkeypatch.setenv("CATALOG_RABBITMQ_EVENT_PUBLISH_ENABLED", "false")
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


def import_green(client: TestClient) -> None:
    response = client.post(
        "/imports/providers/greenPlug",
        headers=auth_headers(["OPERATOR"], "operator@saasplug.local"),
    )
    assert response.status_code == 200


def scheduler_headers() -> dict[str, str]:
    return {"X-Scheduler-Token": "scheduler-test-token", "X-Job-Run-Id": "scheduler-run-1"}


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


def test_successful_import_publishes_catalog_imported_event(test_context, monkeypatch) -> None:
    client, _ = test_context
    fake_publisher = enable_fake_event_publisher(monkeypatch)

    response = client.post(
        "/imports/providers/redPlug",
        headers=auth_headers(["OPERATOR"], "operator@saasplug.local"),
    )

    assert response.status_code == 200
    assert len(fake_publisher.envelopes) == 1
    envelope = fake_publisher.envelopes[0]
    assert envelope.event_type == EventType.CATALOG_POINTS_IMPORTED.value
    assert envelope.producer == "catalog-service"
    assert envelope.payload["provider_code"] == "redPlug"
    assert envelope.payload["catalog_upserted_count"] == 2


def test_scheduler_internal_import_requires_scheduler_token(test_context) -> None:
    client, _ = test_context

    response = client.post("/internal/jobs/catalog/imports/providers/redPlug")

    assert response.status_code == 401


def test_scheduler_internal_import_requires_job_run_id(test_context) -> None:
    client, _ = test_context

    response = client.post(
        "/internal/jobs/catalog/imports/providers/redPlug",
        headers={"X-Scheduler-Token": "scheduler-test-token"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Missing scheduler job run id"


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


def test_scheduler_all_import_can_be_scoped_to_one_provider(test_context) -> None:
    client, _ = test_context

    response = client.post(
        "/internal/jobs/catalog/imports/all",
        headers=scheduler_headers(),
        json={"provider_code": "greenPlug"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert [provider["provider_code"] for provider in payload["providers"]] == ["greenPlug"]


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


def test_provider_admin_points_listing_is_scoped_to_own_provider(test_context) -> None:
    client, _ = test_context
    import_red(client)
    import_green(client)

    response = client.get(
        "/points?includeStale=true",
        headers=auth_headers(["PROVIDER_ADMIN"], "red-admin@saasplug.local", "redPlug"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert {item["provider_code"] for item in payload["items"]} == {"redPlug"}


def test_provider_admin_points_listing_rejects_other_provider_filter(test_context) -> None:
    client, _ = test_context
    import_red(client)
    import_green(client)

    response = client.get(
        "/points?providerCode=greenPlug&includeStale=true",
        headers=auth_headers(["PROVIDER_ADMIN"], "red-admin@saasplug.local", "redPlug"),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Provider admin can only view own provider catalog"


def test_first_catalog_page_publishes_search_event(test_context, monkeypatch) -> None:
    client, _ = test_context
    fake_publisher = enable_fake_event_publisher(monkeypatch)
    import_red(client)
    fake_publisher.envelopes.clear()

    response = client.get(
        "/points?providerCode=redPlug&status=available&q=Red%20Hub",
        headers=auth_headers(["EV_USER"], "evuser@saasplug.local"),
    )

    assert response.status_code == 200
    assert len(fake_publisher.envelopes) == 1
    envelope = fake_publisher.envelopes[0]
    assert envelope.event_type == EventType.USAGE_SEARCH_PERFORMED.value
    assert envelope.payload["user_id"] == "user-evuser@saasplug.local"
    assert envelope.payload["provider_code"] == "redPlug"
    assert envelope.payload["search_term"] == "Red Hub"
    assert envelope.payload["result_count"] == 1


def test_paginated_catalog_offsets_do_not_publish_new_search_events(test_context, monkeypatch) -> None:
    client, _ = test_context
    fake_publisher = enable_fake_event_publisher(monkeypatch)
    import_red(client)
    fake_publisher.envelopes.clear()

    response = client.get("/points?providerCode=redPlug&offset=1")

    assert response.status_code == 200
    assert fake_publisher.envelopes == []


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


def test_points_endpoint_rejects_partial_or_invalid_bounds(test_context) -> None:
    client, _ = test_context
    import_red(client)

    partial_response = client.get("/points?minLat=37.0&maxLat=39.0")
    inverted_response = client.get("/points?minLat=39.0&maxLat=37.0&minLng=23.0&maxLng=24.0")

    assert partial_response.status_code == 400
    assert inverted_response.status_code == 400


def test_points_endpoint_filters_by_center_radius(test_context) -> None:
    client, _ = test_context
    import_red(client)
    center_lat, center_lng = synthetic_coordinates("redPlug", "101")
    db = get_session_factory()()
    try:
        db.add(
            CatalogPoint(
                normalized_point_id="redPlug:outside-circle",
                provider_code="redPlug",
                external_point_id="outside-circle",
                display_name="Outside Circle",
                location_name="Outside Circle",
                address="Just outside radius",
                latitude=center_lat + 0.00016,
                longitude=center_lng + 0.00016,
                coordinate_source="provider",
                status="available",
                is_active=True,
                is_stale=False,
                last_provider_seen_at=datetime.now(timezone.utc),
                last_catalog_sync_at=utcnow(),
                raw_provider_payload={"external_id": "outside-circle"},
            ),
        )
        db.commit()
    finally:
        db.close()

    response = client.get(
        "/points"
        f"?minLat={center_lat - 0.05}&maxLat={center_lat + 0.05}"
        f"&minLng={center_lng - 0.05}&maxLng={center_lng + 0.05}"
        f"&centerLat={center_lat}&centerLng={center_lng}&radiusKm=0.02",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["external_point_id"] == "101"
    assert "outside-circle" not in {item["external_point_id"] for item in payload["items"]}
    assert payload["search_circle"]["center_lat"] == pytest.approx(center_lat)
    assert payload["search_circle"]["center_lng"] == pytest.approx(center_lng)
    assert payload["search_circle"]["radius_km"] == pytest.approx(0.02)


def test_points_endpoint_applies_exact_radius_before_pagination(test_context) -> None:
    client, _ = test_context
    center_lat = 37.985
    center_lng = 23.78
    db = get_session_factory()()
    try:
        db.add_all([
            CatalogPoint(
                normalized_point_id="redPlug:000-outside-circle",
                provider_code="redPlug",
                external_point_id="000-outside-circle",
                display_name="Outside Circle",
                location_name="Outside Circle",
                address="Inside bounding box but outside circle",
                latitude=center_lat + 0.0044,
                longitude=center_lng + 0.0044,
                coordinate_source="provider",
                status="available",
                is_active=True,
                is_stale=False,
                last_provider_seen_at=datetime.now(timezone.utc),
                last_catalog_sync_at=utcnow(),
                raw_provider_payload={"external_id": "000-outside-circle"},
            ),
            CatalogPoint(
                normalized_point_id="redPlug:999-inside-circle",
                provider_code="redPlug",
                external_point_id="999-inside-circle",
                display_name="Inside Circle",
                location_name="Inside Circle",
                address="Inside exact circle",
                latitude=center_lat,
                longitude=center_lng,
                coordinate_source="provider",
                status="available",
                is_active=True,
                is_stale=False,
                last_provider_seen_at=datetime.now(timezone.utc),
                last_catalog_sync_at=utcnow(),
                raw_provider_payload={"external_id": "999-inside-circle"},
            ),
        ])
        db.commit()
    finally:
        db.close()

    response = client.get(f"/points?centerLat={center_lat}&centerLng={center_lng}&radiusKm=0.5&limit=1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["bounds_applied"] is True
    assert payload["search_circle"]["center_lat"] == pytest.approx(center_lat)
    assert payload["search_circle"]["center_lng"] == pytest.approx(center_lng)
    assert payload["search_circle"]["radius_km"] == pytest.approx(0.5)
    assert [item["external_point_id"] for item in payload["items"]] == ["999-inside-circle"]


def test_points_endpoint_rejects_partial_radius_parameters(test_context) -> None:
    client, _ = test_context
    import_red(client)

    response = client.get("/points?centerLat=37.985&centerLng=23.78")

    assert response.status_code == 400
    assert response.json()["detail"] == "All radius parameters must be provided"


def test_points_endpoint_rejects_unsupported_provider_filter(test_context) -> None:
    client, _ = test_context

    response = client.get("/points?providerCode=yellowPlug")

    assert response.status_code == 400
    assert "Unsupported provider code" in response.json()["detail"]


def test_cached_point_details_are_returned_without_live_provider_call(test_context) -> None:
    client, _ = test_context
    import_red(client)

    response = client.get("/points/redPlug/101")

    assert response.status_code == 200
    payload = response.json()
    assert payload["normalized_point_id"] == "redPlug:101"
    assert payload["raw_provider_payload"]["external_id"] == "101"


def test_point_detail_publishes_point_view_event(test_context, monkeypatch) -> None:
    client, _ = test_context
    fake_publisher = enable_fake_event_publisher(monkeypatch)
    import_red(client)
    fake_publisher.envelopes.clear()

    response = client.get(
        "/points/redPlug/101",
        headers=auth_headers(["EV_USER"], "evuser@saasplug.local"),
    )

    assert response.status_code == 200
    assert len(fake_publisher.envelopes) == 1
    envelope = fake_publisher.envelopes[0]
    assert envelope.event_type == EventType.USAGE_POINT_VIEWED.value
    assert envelope.payload["provider_code"] == "redPlug"
    assert envelope.payload["external_point_id"] == "101"
    assert envelope.payload["user_id"] == "user-evuser@saasplug.local"


def test_stale_point_details_are_hidden_from_normal_detail_path(test_context) -> None:
    client, _ = test_context
    import_red(client)
    db = get_session_factory()()
    try:
        point = db.query(CatalogPoint).filter(CatalogPoint.provider_code == "redPlug", CatalogPoint.external_point_id == "101").one()
        point.is_active = False
        point.is_stale = True
        db.commit()
    finally:
        db.close()

    detail_response = client.get("/points/redPlug/101")
    list_response = client.get("/points?providerCode=redPlug&includeStale=true")

    assert detail_response.status_code == 404
    assert list_response.status_code == 200
    assert any(item["external_point_id"] == "101" and item["is_stale"] for item in list_response.json()["items"])


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
