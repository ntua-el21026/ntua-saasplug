from dataclasses import dataclass
from typing import Any

import httpx

from app import provider_config
from app.config import Settings


@dataclass
class ProviderHttpResult:
    payload: Any
    status_code: int | None
    endpoint: str


class ProviderClientError(Exception):
    def __init__(
        self,
        error_type: str,
        message: str,
        external_status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.error_type = error_type
        self.message = message
        self.external_status_code = external_status_code

    def to_response(self, provider_code: str) -> dict[str, str | int | None]:
        return {
            "provider_code": provider_code,
            "error_type": self.error_type,
            "message": self.message,
            "external_status_code": self.external_status_code,
        }


class ProviderHttpClient:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None) -> None:
        self.settings = settings
        headers = {}
        if settings.api_key_value:
            headers["authorization"] = settings.api_key_value
        self.client = httpx.Client(
            base_url=settings.provider_base_url,
            headers=headers,
            timeout=settings.request_timeout_seconds,
            transport=transport,
        )

    def close(self) -> None:
        self.client.close()

    def _request(
        self,
        method: str,
        endpoint: str,
        *,
        json_body: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> ProviderHttpResult:
        try:
            response = self.client.request(method, endpoint, json=json_body, params=params)
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise ProviderClientError("provider_timeout", "Provider request timed out") from exc
        except httpx.ConnectError as exc:
            raise ProviderClientError("provider_unavailable", "Provider is unavailable") from exc
        except httpx.HTTPStatusError as exc:
            error_type = "provider_not_found" if exc.response.status_code == 404 else "provider_http_error"
            raise ProviderClientError(
                error_type,
                "Provider returned an HTTP error",
                exc.response.status_code,
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderClientError("provider_unavailable", "Provider request failed") from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise ProviderClientError(
                "provider_unexpected_response",
                "Provider returned non-JSON response",
                response.status_code,
            ) from exc
        return ProviderHttpResult(payload=payload, status_code=response.status_code, endpoint=endpoint)

    def list_points(self) -> ProviderHttpResult:
        return self._request("GET", provider_config.LIST_PATH)

    def get_point(self, external_point_id: str) -> ProviderHttpResult:
        endpoint = provider_config.DETAIL_PATH_TEMPLATE.format(pointid=external_point_id)
        return self._request("GET", endpoint)

    def get_status(self, external_point_id: str) -> ProviderHttpResult:
        endpoint = provider_config.STATUS_PATH_TEMPLATE.format(pointid=external_point_id)
        return self._request("GET", endpoint)

    def reserve_point(self, external_point_id: str, duration_minutes: int | None) -> ProviderHttpResult:
        minutes = duration_minutes or 60
        if provider_config.RESERVE_STRATEGY == "red_path_duration":
            endpoint = provider_config.RESERVE_WITH_DURATION_PATH_TEMPLATE.format(
                pointid=external_point_id,
                minutes=minutes,
            )
            return self._request("POST", endpoint)
        if provider_config.RESERVE_STRATEGY == "green_json_duration":
            endpoint = provider_config.RESERVE_PATH_TEMPLATE.format(pointid=external_point_id)
            return self._request("POST", endpoint, json_body={"duration": minutes})
        endpoint = provider_config.RESERVE_PATH_TEMPLATE.format(pointid=external_point_id)
        return self._request("POST", endpoint, params={"minutes": minutes})
