import base64
import json

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.main import app
from app.models import User
from app.seed import seed_demo_users
from app.security import hash_password


DEMO_PASSWORD = "test-demo-password"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'auth-test.db'}"
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("SAASPLUG_STRICT_SECRETS", "false")
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


def test_demo_user_edits_survive_default_seed_execution(client: TestClient) -> None:
    db = get_session_factory()()
    try:
        user = db.query(User).filter(User.email == "red-admin@saasplug.local").one()
        custom_hash = hash_password("changed-local-password")
        user.password_hash = custom_hash
        user.auth_provider = "google"
        user.google_subject = "existing-google-subject"
        user.last_login_method = "google"
        user.roles = ["EV_USER"]
        user.provider_id = None
        user.provider_code = None
        user.is_active = False
        db.commit()

        seed_demo_users(db, get_settings())
        db.refresh(user)

        assert user.password_hash == custom_hash
        assert user.auth_provider == "google"
        assert user.google_subject == "existing-google-subject"
        assert user.last_login_method == "google"
        assert user.roles == ["EV_USER"]
        assert user.provider_id is None
        assert user.provider_code is None
        assert user.is_active is False
    finally:
        db.close()


def test_demo_user_seed_can_be_explicitly_reset_for_local_setup(client: TestClient, monkeypatch) -> None:
    db = get_session_factory()()
    try:
        user = db.query(User).filter(User.email == "red-admin@saasplug.local").one()
        user.password_hash = hash_password("changed-local-password")
        user.roles = ["EV_USER"]
        user.provider_id = None
        user.provider_code = None
        user.is_active = False
        db.commit()

        monkeypatch.setenv("RESET_DEMO_USERS_ON_STARTUP", "true")
        seed_demo_users(db, get_settings())
        db.refresh(user)

        assert user.roles == ["PROVIDER_ADMIN"]
        assert user.provider_code == "redPlug"
        assert user.provider_id
        assert user.is_active is True
    finally:
        db.close()


def test_strict_secret_validation_rejects_auth_placeholders(monkeypatch) -> None:
    monkeypatch.setenv("SAASPLUG_STRICT_SECRETS", "true")
    monkeypatch.setenv("JWT_SECRET", "change-me-in-local-env")
    monkeypatch.setenv("DEMO_USER_PASSWORD", "strict-demo-password")

    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        get_settings()

    monkeypatch.setenv("JWT_SECRET", "strict-jwt-secret")
    monkeypatch.setenv("DEMO_USER_PASSWORD", "change-me-demo-password")

    with pytest.raises(RuntimeError, match="DEMO_USER_PASSWORD"):
        get_settings()


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
    assert user["auth_provider"] == "local"
    assert user["last_login_method"] == "local"
    assert user["password_change_supported"] is True


def test_register_rejects_duplicate_email_case_insensitively(client: TestClient) -> None:
    first_response = client.post(
        "/auth/register",
        json={"email": "CaseUser@example.com", "password": "safe-example-password"},
    )
    duplicate_response = client.post(
        "/auth/register",
        json={"email": "caseuser@example.com", "password": "safe-example-password"},
    )

    assert first_response.status_code == 201
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"] == "User already exists"


def test_refresh_rejects_unknown_refresh_token(client: TestClient) -> None:
    response = client.post("/auth/refresh", json={"refresh_token": "not-issued-by-auth-service-token-0000"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid refresh token"


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


def test_role_check_endpoints_reject_missing_or_wrong_role_tokens(client: TestClient) -> None:
    provider_admin = login(client, "red-admin@saasplug.local")
    ev_user = login(client, "evuser@saasplug.local")

    missing_operator_response = client.get("/auth/require-operator")
    provider_as_operator_response = client.get(
        "/auth/require-operator",
        headers={"Authorization": f"Bearer {provider_admin['access_token']}"},
    )
    ev_as_provider_response = client.get(
        "/auth/require-provider-admin",
        headers={"Authorization": f"Bearer {ev_user['access_token']}"},
    )

    assert missing_operator_response.status_code == 401
    assert provider_as_operator_response.status_code == 403
    assert ev_as_provider_response.status_code == 403


def test_google_oauth_hooks_fail_safely_in_local_placeholder_mode(client: TestClient) -> None:
    login_response = client.get("/auth/google/login")
    callback_response = client.get("/auth/google/callback")

    assert login_response.status_code == 200
    assert login_response.json()["configured"] is False
    assert login_response.json()["status"] == "google_oauth_not_configured"
    assert callback_response.status_code == 200
    assert callback_response.json()["configured"] is False


def test_google_login_uses_backend_redirect_uri_when_configured(client: TestClient, monkeypatch) -> None:
    frontend_redirect_uri = "http://localhost:8080/login/google/callback"
    backend_redirect_uri = "http://localhost:8080/api/auth/auth/google/callback"
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", backend_redirect_uri)

    response = client.get(
        "/auth/google/login",
        params={"redirect_uri": frontend_redirect_uri},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["configured"] is True
    assert "authorization_url" in payload
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fauth%2Fauth%2Fgoogle%2Fcallback" in payload["authorization_url"]
    assert frontend_redirect_uri not in payload["authorization_url"]


def test_google_callback_uses_frontend_redirect_uri_and_registers_ev_user(client: TestClient, monkeypatch) -> None:
    frontend_redirect_uri = "http://localhost:8080/login/google/callback"
    captured: dict[str, str | None] = {}
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "http://localhost:8080/api/auth/auth/google/callback")

    def fake_fetch_google_identity(code, settings, redirect_uri=None):
        captured["code"] = code
        captured["redirect_uri"] = redirect_uri
        return {"email": "configured-google@example.com", "sub": "google-subject-1"}

    monkeypatch.setattr("app.routes.fetch_google_identity", fake_fetch_google_identity)

    response = client.get(
        "/auth/google/callback",
        params={"code": "google-code", "redirect_uri": frontend_redirect_uri},
    )

    assert response.status_code == 200
    assert captured == {"code": "google-code", "redirect_uri": frontend_redirect_uri}
    user = response.json()["user"]
    assert user["email"] == "configured-google@example.com"
    assert user["roles"] == ["EV_USER"]
    assert user["auth_provider"] == "google"
    assert user["last_login_method"] == "google"
    assert user["password_change_supported"] is False


def test_google_backend_callback_redirects_to_frontend_with_ev_session(client: TestClient, monkeypatch) -> None:
    captured: dict[str, str | None] = {}
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "http://localhost:8080/api/auth/auth/google/callback")
    monkeypatch.setenv("GOOGLE_FRONTEND_CALLBACK_URI", "http://localhost:8080/login/google/callback")

    def fake_fetch_google_identity(code, settings, redirect_uri=None):
        captured["code"] = code
        captured["redirect_uri"] = redirect_uri
        return {"email": "backend-google@example.com", "sub": "google-subject-2"}

    monkeypatch.setattr("app.routes.fetch_google_identity", fake_fetch_google_identity)

    response = client.get(
        "/auth/google/callback",
        params={"code": "google-code"},
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert captured == {"code": "google-code", "redirect_uri": None}
    location = response.headers["location"]
    assert location.startswith("http://localhost:8080/login/google/callback#payload=")
    encoded_payload = location.split("#payload=", 1)[1]
    padding = "=" * ((4 - len(encoded_payload) % 4) % 4)
    payload = json.loads(base64.urlsafe_b64decode(f"{encoded_payload}{padding}").decode("utf-8"))
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["user"]["email"] == "backend-google@example.com"
    assert payload["user"]["roles"] == ["EV_USER"]
    assert payload["user"]["auth_provider"] == "google"


def test_local_google_sign_in_registers_new_ev_user_and_reuses_account(client: TestClient) -> None:
    first_response = client.post(
        "/auth/google/local-sign-in",
        json={"email": "new-google-user@example.com"},
    )
    second_response = client.post(
        "/auth/google/local-sign-in",
        json={"email": "NEW-GOOGLE-USER@example.com"},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    first_user = first_response.json()["user"]
    second_user = second_response.json()["user"]
    assert first_user["id"] == second_user["id"]
    assert first_user["email"] == "new-google-user@example.com"
    assert first_user["roles"] == ["EV_USER"]
    assert first_user["provider_id"] is None
    assert first_user["provider_code"] is None
    assert first_user["auth_provider"] == "google"
    assert first_user["last_login_method"] == "google"
    assert first_user["password_change_supported"] is False


def test_google_sign_in_rejects_operator_and_provider_accounts(client: TestClient) -> None:
    operator_response = client.post(
        "/auth/google/local-sign-in",
        json={"email": "operator@saasplug.local"},
    )
    provider_response = client.post(
        "/auth/google/local-sign-in",
        json={"email": "red-admin@saasplug.local"},
    )

    assert operator_response.status_code == 403
    assert provider_response.status_code == 403
    assert operator_response.json()["detail"] == "Google sign-in is available only for EV user accounts."


@pytest.mark.parametrize(
    "email",
    [
        "evuser@saasplug.local",
        "operator@saasplug.local",
        "red-admin@saasplug.local",
    ],
)
def test_local_password_users_can_change_password(client: TestClient, email: str) -> None:
    login_payload = login(client, email)

    change_response = client.post(
        "/auth/password",
        headers={"Authorization": f"Bearer {login_payload['access_token']}"},
        json={
            "current_password": DEMO_PASSWORD,
            "new_password": "new-safe-demo-password",
        },
    )
    old_login_response = client.post(
        "/auth/login",
        json={"email": email, "password": DEMO_PASSWORD},
    )
    new_login_response = client.post(
        "/auth/login",
        json={"email": email, "password": "new-safe-demo-password"},
    )

    assert change_response.status_code == 200
    assert change_response.json() == {"status": "password_changed"}
    assert old_login_response.status_code == 401
    assert new_login_response.status_code == 200


def test_google_created_user_cannot_change_password_or_login_locally(client: TestClient) -> None:
    google_payload = client.post(
        "/auth/google/local-sign-in",
        json={"email": "google-only@example.com"},
    ).json()

    change_response = client.post(
        "/auth/password",
        headers={"Authorization": f"Bearer {google_payload['access_token']}"},
        json={
            "current_password": "anything-safe",
            "new_password": "new-safe-demo-password",
        },
    )
    local_login_response = client.post(
        "/auth/login",
        json={"email": "google-only@example.com", "password": "new-safe-demo-password"},
    )

    assert change_response.status_code == 403
    assert local_login_response.status_code == 401
