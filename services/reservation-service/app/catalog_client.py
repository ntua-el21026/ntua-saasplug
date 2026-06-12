import httpx
from pydantic import ValidationError

from app.config import Settings
from app.schemas import CatalogPointDTO


class CatalogServiceError(Exception):
    def __init__(
        self,
        provider_code: str,
        external_point_id: str,
        error_type: str,
        message: str,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.provider_code = provider_code
        self.external_point_id = external_point_id
        self.error_type = error_type
        self.message = message
        self.status_code = status_code


class CatalogServiceClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = httpx.Client(timeout=settings.provider_timeout_seconds)

    def close(self) -> None:
        self._client.close()

    def get_point(self, provider_code: str, external_point_id: str) -> CatalogPointDTO:
        url = f"{self.settings.catalog_service_url}/points/{provider_code}/{external_point_id}"
        try:
            response = self._client.get(url)
        except httpx.TimeoutException as exc:
            raise CatalogServiceError(
                provider_code,
                external_point_id,
                "catalog_timeout",
                "Catalog point resolution timed out",
            ) from exc
        except httpx.RequestError as exc:
            raise CatalogServiceError(
                provider_code,
                external_point_id,
                "catalog_request_error",
                "Catalog point resolution failed",
            ) from exc

        if response.status_code == 404:
            raise CatalogServiceError(
                provider_code,
                external_point_id,
                "catalog_point_not_found",
                "Catalog point not found",
                response.status_code,
            )
        if response.status_code >= 400:
            raise CatalogServiceError(
                provider_code,
                external_point_id,
                "catalog_service_error",
                "Catalog point resolution failed",
                response.status_code,
            )

        try:
            payload = response.json()
            point = CatalogPointDTO.model_validate(payload)
        except (ValueError, ValidationError) as exc:
            raise CatalogServiceError(
                provider_code,
                external_point_id,
                "catalog_unexpected_response",
                "Catalog point resolution returned an invalid response",
                response.status_code,
            ) from exc

        if point.provider_code != provider_code or point.external_point_id != external_point_id:
            raise CatalogServiceError(
                provider_code,
                external_point_id,
                "catalog_point_mismatch",
                "Catalog point resolution returned a mismatched point",
                response.status_code,
            )
        return point
