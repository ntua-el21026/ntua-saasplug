import jwt
import pytest
from fastapi.testclient import TestClient

from app.database import reset_database_for_tests
from app.main import app


DEMO_PASSWORD = "test-demo-password"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'auth-test.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret")
    monkeypatch.setenv("DEMO_USER_PASSWORD", DEMO_PASSWORD)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "replace-me")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "replace-me")
    monkeypatch.setenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8080/api/auth/auth/google/callback",
    )
    reset_database_for_tests(database_url)
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, email: str, password: str = DEMO_PASSWORD) -> dict:
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()


def test_health_endpoint_remains_available(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"service": "auth-service", "status": "healthy"}


def test_seed_user_can_login_and_call_me(client: TestClient) -> None:
    login_payload = login(client, "operator@saasplug.local")

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {login_payload['access_token']}"},
    )

    assert response.status_code == 200
    user = response.json()
    assert user["email"] == "operator@saasplug.local"
    assert user["roles"] == ["OPERATOR"]
    assert user["provider_id"] is None
    assert user["provider_code"] is None


def test_invalid_login_fails_without_user_enumeration(client: TestClient) -> None:
    response = client.post(
        "/auth/login",
        json={"email": "operator@saasplug.local", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_provider_admin_token_contains_provider_scope(client: TestClient) -> None:
    login_payload = login(client, "red-admin@saasplug.local")

    claims = jwt.decode(
        login_payload["access_token"],
        "test-jwt-secret",
        algorithms=["HS256"],
    )

    assert claims["email"] == "red-admin@saasplug.local"
    assert claims["roles"] == ["PROVIDER_ADMIN"]
    assert claims["provider_code"] == "redPlug"
    assert claims["provider_id"]
    assert login_payload["user"]["provider_code"] == "redPlug"


def test_refresh_token_can_issue_new_access_token(client: TestClient) -> None:
    login_payload = login(client, "evuser@saasplug.local")

    response = client.post(
        "/auth/refresh",
        json={"refresh_token": login_payload["refresh_token"]},
    )

    assert response.status_code == 200
    refreshed = response.json()
    assert refreshed["access_token"]
    assert refreshed["refresh_token"] == login_payload["refresh_token"]
    assert refreshed["user"]["email"] == "evuser@saasplug.local"


def test_logout_revokes_refresh_token(client: TestClient) -> None:
    login_payload = login(client, "evuser@saasplug.local")

    logout_response = client.post(
        "/auth/logout",
        json={"refresh_token": login_payload["refresh_token"]},
    )
    refresh_response = client.post(
        "/auth/refresh",
        json={"refresh_token": login_payload["refresh_token"]},
    )

    assert logout_response.status_code == 200
    assert logout_response.json() == {"status": "logged_out"}
    assert refresh_response.status_code == 401


def test_public_register_creates_ev_user_only(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={
            "email": "new-user@example.com",
            "password": "safe-example-password",
            "roles": ["OPERATOR"],
            "provider_code": "redPlug",
        },
    )

    assert response.status_code == 201
    user = response.json()["user"]
    assert user["email"] == "new-user@example.com"
    assert user["roles"] == ["EV_USER"]
    assert user["provider_id"] is None
    assert user["provider_code"] is None


def test_role_and_provider_scope_endpoints_require_valid_roles(client: TestClient) -> None:
    operator = login(client, "operator@saasplug.local")
    ev_user = login(client, "evuser@saasplug.local")
    provider_admin = login(client, "green-admin@saasplug.local")

    operator_response = client.get(
        "/auth/require-operator",
        headers={"Authorization": f"Bearer {operator['access_token']}"},
    )
    ev_operator_response = client.get(
        "/auth/require-operator",
        headers={"Authorization": f"Bearer {ev_user['access_token']}"},
    )
    provider_response = client.get(
        "/auth/require-provider-admin",
        headers={"Authorization": f"Bearer {provider_admin['access_token']}"},
    )

    assert operator_response.status_code == 200
    assert ev_operator_response.status_code == 403
    assert provider_response.status_code == 200
    assert provider_response.json()["provider_code"] == "greenPlug"


def test_google_oauth_hooks_fail_safely_in_local_placeholder_mode(client: TestClient) -> None:
    login_response = client.get("/auth/google/login")
    callback_response = client.get("/auth/google/callback")

    assert login_response.status_code == 200
    assert login_response.json()["configured"] is False
    assert login_response.json()["status"] == "google_oauth_not_configured"
    assert callback_response.status_code == 200
    assert callback_response.json()["configured"] is False
