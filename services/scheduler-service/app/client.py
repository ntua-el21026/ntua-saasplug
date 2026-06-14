from typing import Any

import httpx

from app.config import Settings
from app.models import JobRun, ScheduledJob

SENSITIVE_FRAGMENTS = ("token", "secret", "password", "api_key", "apikey", "authorization", "credential")


class InternalJobClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = httpx.Client(timeout=settings.http_timeout_seconds)

    def close(self) -> None:
        self._client.close()

    def call(self, job: ScheduledJob, run: JobRun, request_body: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
        base_url = self.settings.service_url(job.target_service)
        url = f"{base_url}{job.target_url_path}"
        response = self._client.request(
            job.http_method,
            url,
            headers={
                "X-Scheduler-Token": self.settings.internal_token,
                "X-Job-Run-Id": run.id,
                "X-Correlation-Id": run.correlation_id,
            },
            json=request_body if request_body else None,
        )
        return response.status_code, summarize_response(response)


def summarize_response(response: httpx.Response) -> dict[str, Any]:
    summary: dict[str, Any] = {"status_code": response.status_code}
    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            payload = response.json()
        except ValueError:
            summary["json_valid"] = False
            return summary
        summary["json_valid"] = True
        summary["body"] = summarize_value(payload)
        return summary

    text = response.text[:300] if response.text else ""
    summary["json_valid"] = False
    if text:
        summary["text_preview"] = redact_string(text)
    return summary


def summarize_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: redact_value(key, nested) for key, nested in list(value.items())[:30]}
    if isinstance(value, list):
        return {
            "type": "array",
            "count": len(value),
            "first_item_keys": sorted(value[0].keys()) if value and isinstance(value[0], dict) else [],
        }
    return value


def redact_value(key: str, value: Any) -> Any:
    lowered = key.lower()
    if any(fragment in lowered for fragment in SENSITIVE_FRAGMENTS):
        return "[redacted]"
    if isinstance(value, dict | list):
        return summarize_value(value)
    if isinstance(value, str):
        return redact_string(value)
    return value


def redact_string(value: str) -> str:
    if len(value) > 300:
        return f"{value[:300]}..."
    return value
