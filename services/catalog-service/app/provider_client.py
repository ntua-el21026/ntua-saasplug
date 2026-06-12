import httpx
from pydantic import ValidationError

from app.config import Settings
from app.schemas import ProviderPointDTO, ProviderSyncSummaryDTO


class ProviderServiceError(Exception):
    def __init__(self, provider_code: str, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.provider_code = provider_code
        self.message = message
        self.status_code = status_code


class ProviderServiceClient:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None) -> None:
        self.settings = settings
        self._client = httpx.Client(timeout=settings.provider_http_timeout_seconds, transport=transport)

    def close(self) -> None:
        self._client.close()

    def _request(self, provider_code: str, method: str, path: str) -> httpx.Response:
        base_url = self.settings.provider_service_url(provider_code)
        url = f"{base_url}{path}"
        try:
            response = self._client.request(method, url)
        except httpx.HTTPError as exc:
            raise ProviderServiceError(provider_code, "Provider service request failed") from exc
        if response.status_code >= 400:
            raise ProviderServiceError(
                provider_code,
                "Provider service returned an error",
                response.status_code,
            )
        return response

    def sync_provider(self, provider_code: str) -> ProviderSyncSummaryDTO:
        response = self._request(provider_code, "POST", "/internal/sync")
        try:
            return ProviderSyncSummaryDTO.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            raise ProviderServiceError(provider_code, "Provider sync response was invalid") from exc

    def list_points(self, provider_code: str) -> list[ProviderPointDTO]:
        response = self._request(provider_code, "GET", "/internal/points")
        try:
            payload = response.json()
        except ValueError as exc:
            raise ProviderServiceError(provider_code, "Provider point list response was invalid") from exc
        if not isinstance(payload, list):
            raise ProviderServiceError(provider_code, "Provider point list was not an array")
        try:
            return [ProviderPointDTO.model_validate(point) for point in payload]
        except ValidationError as exc:
            raise ProviderServiceError(provider_code, "Provider point list contained invalid items") from exc

    def get_provider(self, provider_code: str) -> dict:
        response = self._request(provider_code, "GET", "/internal/provider")
        try:
            payload = response.json()
        except ValueError as exc:
            raise ProviderServiceError(provider_code, "Provider identity response was invalid") from exc
        if not isinstance(payload, dict):
            raise ProviderServiceError(provider_code, "Provider identity response was invalid")
        return payload
