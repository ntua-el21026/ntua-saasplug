from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app.database import get_session_factory, reset_database_for_tests
from app.main import app
from app.models import Provider, ProviderConfigAuditLog
from app.seed import provider_id_for, seed_providers
from app.config import get_settings

JWT_SECRET = "test-jwt-secret"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'provider-registry-test.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    monkeypatch.setenv("PROVIDER_API_TIMEOUT_SECONDS", "10")
    monkeypatch.setenv("RED_PROVIDER_BASE_URL", "https://example.test/red")
    monkeypatch.setenv("GREEN_PROVIDER_BASE_URL", "https://example.test/green")
    monkeypatch.setenv("BLUE_PROVIDER_BASE_URL", "https://example.test/blue")
    reset_database_for_tests(database_url)
    with TestClient(app) as test_client:
        yield test_client


def token_for(role: str, provider_code: str | None = None) -> str:
    claims = {
        "sub": f"{role.lower()}-user-id",
        "email": f"{role.lower()}@saasplug.local",
        "roles": [role],
        "provider_id": provider_id_for(provider_code) if provider_code else None,
        "provider_code": provider_code,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
    }
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


def auth_header(role: str, provider_code: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {token_for(role, provider_code)}"}


def test_health_endpoint_still_works(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "service": "provider-registry-service",
        "status": "healthy",
    }


def test_seed_providers_are_idempotent(client: TestClient) -> None:
    db = get_session_factory()()
    try:
        initial_provider_count = len(db.query(Provider).all())
        initial_audit_count = len(db.query(ProviderConfigAuditLog).all())
        seed_providers(db, get_settings())
        final_provider_count = len(db.query(Provider).all())
        final_audit_count = len(db.query(ProviderConfigAuditLog).all())
    finally:
        db.close()

    assert initial_provider_count == 3
    assert final_provider_count == 3
    assert final_audit_count == initial_audit_count


def test_operator_can_list_all_seeded_providers(client: TestClient) -> None:
    response = client.get("/providers", headers=auth_header("OPERATOR"))

    assert response.status_code == 200
    provider_codes = {provider["provider_code"] for provider in response.json()}
    assert provider_codes == {"redPlug", "greenPlug", "bluePlug"}


def test_provider_admin_can_read_only_own_provider(client: TestClient) -> None:
    own_response = client.get(
        "/providers/redPlug",
        headers=auth_header("PROVIDER_ADMIN", "redPlug"),
    )
    other_response = client.get(
        "/providers/greenPlug",
        headers=auth_header("PROVIDER_ADMIN", "redPlug"),
    )
    list_response = client.get(
        "/providers",
        headers=auth_header("PROVIDER_ADMIN", "redPlug"),
    )

    assert own_response.status_code == 200
    assert own_response.json()["provider_code"] == "redPlug"
    assert other_response.status_code == 403
    assert list_response.status_code == 200
    assert [provider["provider_code"] for provider in list_response.json()] == ["redPlug"]


def test_provider_admin_cannot_update_another_provider(client: TestClient) -> None:
    response = client.patch(
        "/providers/greenPlug",
        json={"display_name": "Blocked Update"},
        headers=auth_header("PROVIDER_ADMIN", "redPlug"),
    )

    assert response.status_code == 403


def test_ev_user_cannot_access_management_endpoints(client: TestClient) -> None:
    response = client.get("/providers", headers=auth_header("EV_USER"))

    assert response.status_code == 403


def test_operator_can_update_metadata_and_status(client: TestClient) -> None:
    update_response = client.patch(
        "/providers/redPlug",
        json={"display_name": "Red Plug Updated", "timeout_seconds": 15},
        headers=auth_header("OPERATOR"),
    )
    status_response = client.patch(
        "/providers/redPlug/status",
        json={"is_active": False},
        headers=auth_header("OPERATOR"),
    )

    assert update_response.status_code == 200
    assert update_response.json()["display_name"] == "Red Plug Updated"
    assert update_response.json()["timeout_seconds"] == 15
    assert status_response.status_code == 200
    assert status_response.json()["is_active"] is False


def test_operator_cannot_create_duplicate_provider_code(client: TestClient) -> None:
    response = client.post(
        "/providers",
        json={
            "provider_code": "redPlug",
            "display_name": "Duplicate Red Plug",
            "api_base_url": "https://duplicate.example.test",
        },
        headers=auth_header("OPERATOR"),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Provider already exists"


def test_provider_admin_can_update_only_safe_own_metadata(client: TestClient) -> None:
    safe_response = client.patch(
        "/providers/redPlug",
        json={"contact_email": "red-ops@example.com"},
        headers=auth_header("PROVIDER_ADMIN", "redPlug"),
    )
    forbidden_response = client.patch(
        "/providers/redPlug",
        json={"api_base_url": "https://blocked.example.test"},
        headers=auth_header("PROVIDER_ADMIN", "redPlug"),
    )

    assert safe_response.status_code == 200
    assert safe_response.json()["contact_email"] == "red-ops@example.com"
    assert forbidden_response.status_code == 403
    assert "api_base_url" in forbidden_response.json()["detail"]


def test_integration_config_does_not_expose_raw_secret_values(client: TestClient) -> None:
    response = client.get(
        "/providers/redPlug/integration-config",
        headers=auth_header("OPERATOR"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider_code"] == "redPlug"
    assert payload["api_key_env_var"] == "RED_PROVIDER_API_KEY"
    assert "replace-me" not in str(payload)
    assert "api_key" not in payload
    assert payload["secret_configured_elsewhere"] is True


def test_audit_log_is_written_for_provider_update_and_status_change(client: TestClient) -> None:
    client.patch(
        "/providers/bluePlug",
        json={"display_name": "Blue Plug Updated"},
        headers=auth_header("OPERATOR"),
    )
    client.patch(
        "/providers/bluePlug/status",
        json={"is_active": False},
        headers=auth_header("OPERATOR"),
    )

    response = client.get(
        "/providers/bluePlug/audit-logs",
        headers=auth_header("OPERATOR"),
    )

    assert response.status_code == 200
    actions = [entry["action"] for entry in response.json()]
    assert "updated" in actions
    assert "status_changed" in actions
