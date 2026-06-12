import httpx
from pydantic import ValidationError

from app.config import Settings
from app.schemas import ProviderStatusDTO


class ProviderServiceError(Exception):
    def __init__(
        self,
        provider_code: str,
        error_type: str,
        message: str,
        status_code: int | None = None,
        external_status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.provider_code = provider_code
        self.error_type = error_type
        self.message = message
        self.status_code = status_code
        self.external_status_code = external_status_code


class ProviderServiceClient:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None) -> None:
        self.settings = settings
        self._client = httpx.Client(timeout=settings.provider_timeout_seconds, transport=transport)

    def close(self) -> None:
        self._client.close()

    def get_status(self, provider_code: str, external_point_id: str) -> ProviderStatusDTO:
        base_url = self.settings.provider_service_url(provider_code)
        url = f"{base_url}/internal/points/{external_point_id}/status"
        try:
            response = self._client.get(url)
        except httpx.TimeoutException as exc:
            raise ProviderServiceError(provider_code, "provider_timeout", "Provider service timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderServiceError(
                provider_code,
                "provider_request_failed",
                "Provider service request failed",
            ) from exc

        if response.status_code >= 400:
            error_type = "provider_service_error"
            message = "Provider service returned an error"
            external_status_code: int | None = None
            try:
                detail = response.json().get("detail")
            except ValueError:
                detail = None
            if isinstance(detail, dict):
                raw_error_type = detail.get("error_type")
                raw_message = detail.get("message")
                raw_external_status_code = detail.get("external_status_code")
                if isinstance(raw_error_type, str):
                    error_type = raw_error_type
                if isinstance(raw_message, str):
                    message = raw_message
                if isinstance(raw_external_status_code, int):
                    external_status_code = raw_external_status_code
            raise ProviderServiceError(
                provider_code,
                error_type,
                message,
                response.status_code,
                external_status_code,
            )

        try:
            return ProviderStatusDTO.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            raise ProviderServiceError(
                provider_code,
                "provider_invalid_response",
                "Provider status response was invalid",
                response.status_code,
            ) from exc
