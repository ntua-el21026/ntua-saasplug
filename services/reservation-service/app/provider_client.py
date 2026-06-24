import httpx
from pydantic import ValidationError

from app.config import Settings
from app.schemas import ProviderReservationDTO


class ProviderServiceError(Exception):
    def __init__(
        self,
        provider_code: str,
        error_type: str,
        message: str,
        status_code: int | None = None,
        external_status_code: int | None = None,
        ambiguous_outcome: bool = False,
    ) -> None:
        super().__init__(message)
        self.provider_code = provider_code
        self.error_type = error_type
        self.message = message
        self.status_code = status_code
        self.external_status_code = external_status_code
        self.ambiguous_outcome = ambiguous_outcome


class ProviderServiceClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = httpx.Client(timeout=settings.provider_timeout_seconds)

    def close(self) -> None:
        self._client.close()

    def reserve_point(
        self,
        provider_code: str,
        external_point_id: str,
        duration_minutes: int,
    ) -> ProviderReservationDTO:
        try:
            base_url = self.settings.provider_service_url(provider_code)
        except ValueError as exc:
            raise ProviderServiceError(
                provider_code,
                "unsupported_provider",
                "Unsupported provider code",
                400,
            ) from exc

        url = f"{base_url}/internal/points/{external_point_id}/reservations"
        try:
            response = self._client.post(url, json={"duration_minutes": duration_minutes})
        except httpx.TimeoutException as exc:
            raise ProviderServiceError(
                provider_code,
                "provider_timeout",
                "Provider reservation request timed out",
                ambiguous_outcome=True,
            ) from exc
        except httpx.RequestError as exc:
            raise ProviderServiceError(
                provider_code,
                "provider_request_error",
                "Provider reservation request failed",
            ) from exc

        if response.status_code >= 400:
            error_type = "provider_http_error"
            external_status_code = response.status_code
            try:
                payload = response.json()
            except ValueError:
                payload = None
            detail = payload.get("detail") if isinstance(payload, dict) else None
            if isinstance(detail, dict):
                raw_error_type = detail.get("error_type")
                if isinstance(raw_error_type, str):
                    error_type = raw_error_type
                raw_external_status = detail.get("external_status_code")
                if isinstance(raw_external_status, int):
                    external_status_code = raw_external_status
            raise ProviderServiceError(
                provider_code,
                error_type,
                "Provider reservation request failed",
                response.status_code,
                external_status_code,
            )

        try:
            payload = response.json()
            reservation = ProviderReservationDTO.model_validate(payload)
        except (ValueError, ValidationError) as exc:
            raise ProviderServiceError(
                provider_code,
                "provider_unexpected_response",
                "Provider reservation endpoint returned an invalid response",
                response.status_code,
                ambiguous_outcome=True,
            ) from exc

        if reservation.provider_code != provider_code or reservation.external_point_id != external_point_id:
            raise ProviderServiceError(
                provider_code,
                "provider_point_mismatch",
                "Provider reservation endpoint returned a mismatched point",
                response.status_code,
            )
        return reservation
