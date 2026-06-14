import json
from datetime import timedelta
from uuid import uuid4

import httpx
import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import get_session_factory, reset_database_for_tests
from app.executor import select_due_jobs
from app.main import app
from app.models import ScheduledJob, utcnow


def access_token(roles: list[str], email: str) -> str:
    return jwt.encode(
        {
            "sub": f"user-{email}",
            "email": email,
            "roles": roles,
        },
        "scheduler-test-secret",
        algorithm="HS256",
    )


def auth_headers(roles: list[str], email: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token(roles, email)}"}


def operator_headers() -> dict[str, str]:
    return auth_headers(["OPERATOR"], "operator@saasplug.local")


def ev_headers() -> dict[str, str]:
    return auth_headers(["EV_USER"], "evuser@saasplug.local")


@pytest.fixture()
def test_context(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'scheduler-test.db'}"
    monkeypatch.setenv("SCHEDULER_DATABASE_URL", database_url)
    monkeypatch.setenv("SERVICE_NAME", "scheduler-service")
    monkeypatch.setenv("JWT_SECRET", "scheduler-test-secret")
    monkeypatch.setenv("SCHEDULER_RUN_LOOP", "false")
    monkeypatch.setenv("SCHEDULER_INTERNAL_TOKEN", "scheduler-test-token")
    monkeypatch.setenv("SCHEDULER_INSTANCE_ID", "scheduler-test")
    monkeypatch.setenv("CATALOG_SERVICE_URL", "http://catalog-service")
    get_settings.cache_clear()
    reset_database_for_tests(database_url)
    with TestClient(app) as test_client:
        yield test_client
    get_settings.cache_clear()


def test_health_reports_seeded_jobs(test_context) -> None:
    response = test_context.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["total_job_count"] >= 8


def test_operator_can_list_jobs_and_ev_user_cannot(test_context) -> None:
    operator_response = test_context.get("/jobs", headers=operator_headers())
    ev_response = test_context.get("/jobs", headers=ev_headers())

    assert operator_response.status_code == 200
    job_keys = {job["job_key"] for job in operator_response.json()}
    assert "catalog.import.all" in job_keys
    assert "billing.prepare-invoices" in job_keys
    assert ev_response.status_code == 403


def test_operator_can_pause_and_resume_interval_job(test_context) -> None:
    pause_response = test_context.post("/jobs/catalog.import.all/pause", headers=operator_headers())
    resume_response = test_context.post("/jobs/catalog.import.all/resume", headers=operator_headers())

    assert pause_response.status_code == 200
    assert pause_response.json()["enabled"] is False
    assert pause_response.json()["next_run_at"] is None
    assert resume_response.status_code == 200
    assert resume_response.json()["enabled"] is True
    assert resume_response.json()["next_run_at"] is not None


def test_interval_next_run_and_due_job_selection(test_context) -> None:
    session = get_session_factory()()
    try:
        job = session.query(ScheduledJob).filter(ScheduledJob.job_key == "catalog.import.all").one()
        assert job.interval_seconds == 900
        assert job.next_run_at is not None

        job.next_run_at = utcnow() - timedelta(seconds=1)
        session.commit()

        due_jobs = select_due_jobs(session)
        assert [due_job.job_key for due_job in due_jobs] == ["catalog.import.all"]
    finally:
        session.close()


def test_manual_run_calls_internal_endpoint_with_scheduler_headers(test_context, monkeypatch) -> None:
    captured: dict[str, str | dict] = {}
    real_httpx_client = httpx.Client

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["scheduler_token"] = request.headers.get("X-Scheduler-Token", "")
        captured["job_run_id"] = request.headers.get("X-Job-Run-Id", "")
        captured["correlation_id"] = request.headers.get("X-Correlation-Id", "")
        return httpx.Response(
            200,
            json={"status": "completed", "run_id": str(uuid4()), "secret_token": "should-redact"},
            headers={"Content-Type": "application/json"},
        )

    class FakeClient:
        def __init__(self, timeout: float) -> None:
            self.transport = httpx.MockTransport(handler)
            self.client = real_httpx_client(transport=self.transport, timeout=timeout)

        def request(self, *args, **kwargs):
            return self.client.request(*args, **kwargs)

        def close(self) -> None:
            self.client.close()

    monkeypatch.setattr("app.client.httpx.Client", FakeClient)

    response = test_context.post("/jobs/catalog.import.red/run", headers=operator_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "succeeded"
    assert captured["url"] == "http://catalog-service/internal/jobs/catalog/imports/providers/redPlug"
    assert captured["scheduler_token"] == "scheduler-test-token"
    assert captured["job_run_id"] == payload["id"]
    assert captured["correlation_id"] == payload["correlation_id"]
    assert payload["response_summary"]["body"]["secret_token"] == "[redacted]"

    session = get_session_factory()()
    try:
        runs_response = test_context.get("/runs?jobKey=catalog.import.red", headers=operator_headers())
        assert runs_response.status_code == 200
        assert len(runs_response.json()) == 1
    finally:
        session.close()


def test_target_http_error_is_persisted(test_context, monkeypatch) -> None:
    real_httpx_client = httpx.Client

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"status": "unavailable"}, headers={"Content-Type": "application/json"})

    class FakeClient:
        def __init__(self, timeout: float) -> None:
            self.client = real_httpx_client(transport=httpx.MockTransport(handler), timeout=timeout)

        def request(self, *args, **kwargs):
            return self.client.request(*args, **kwargs)

        def close(self) -> None:
            self.client.close()

    monkeypatch.setattr("app.client.httpx.Client", FakeClient)

    response = test_context.post("/jobs/analytics.refresh-aggregates.manual/run", headers=operator_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["target_http_status"] == 503
    assert payload["error_type"] == "target_http_error"


def test_json_request_body_override_is_forwarded(test_context, monkeypatch) -> None:
    captured_body: dict | None = None
    real_httpx_client = httpx.Client

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_body
        captured_body = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"status": "completed"}, headers={"Content-Type": "application/json"})

    class FakeClient:
        def __init__(self, timeout: float) -> None:
            self.client = real_httpx_client(transport=httpx.MockTransport(handler), timeout=timeout)

        def request(self, *args, **kwargs):
            return self.client.request(*args, **kwargs)

        def close(self) -> None:
            self.client.close()

    monkeypatch.setattr("app.client.httpx.Client", FakeClient)

    response = test_context.post(
        "/jobs/catalog.import.red/run",
        headers=operator_headers(),
        json={"request_body": {"force": True}},
    )

    assert response.status_code == 200
    assert captured_body == {"force": True}
