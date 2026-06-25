import httpx

from app.config import Settings
from app.models import CatalogPoint


class StatusServiceClient:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None) -> None:
        self.settings = settings
        self._client = httpx.Client(timeout=settings.status_seed_timeout_seconds, transport=transport)

    def close(self) -> None:
        self._client.close()

    def seed_cache(self, points: list[CatalogPoint]) -> int:
        if not points:
            return 0
        upserted_total = 0
        for start in range(0, len(points), 1000):
            response = self._client.post(
                f"{self.settings.status_service_url}/internal/cache/seed",
                headers={"X-Scheduler-Token": self.settings.scheduler_internal_token},
                json={
                    "points": [
                        {
                            "provider_code": point.provider_code,
                            "external_point_id": point.external_point_id,
                            "status": point.status,
                            "reservation_ends_at": point.reservation_ends_at,
                            "checked_at": point.last_catalog_sync_at.isoformat(),
                            "raw_payload": {"source": "catalog_import"},
                        }
                        for point in points[start:start + 1000]
                    ],
                },
            )
            response.raise_for_status()
            payload = response.json()
            upserted_count = payload.get("upserted_count") if isinstance(payload, dict) else None
            upserted_total += upserted_count if isinstance(upserted_count, int) else 0
        return upserted_total
