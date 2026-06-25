import logging

import httpx

from app.config import Settings
from app.models import Reservation

logger = logging.getLogger(__name__)


class StatusServiceClient:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None) -> None:
        self.settings = settings
        self._client = httpx.Client(timeout=settings.status_seed_timeout_seconds, transport=transport)

    def close(self) -> None:
        self._client.close()

    def seed_reserved_status(self, reservation: Reservation) -> None:
        if reservation.status != "succeeded" or not reservation.reservation_ends_at:
            return
        response = self._client.post(
            f"{self.settings.status_service_url}/internal/cache/seed",
            headers={"X-Scheduler-Token": self.settings.scheduler_internal_token},
            json={
                "points": [
                    {
                        "provider_code": reservation.provider_code,
                        "external_point_id": reservation.external_point_id,
                        "status": "reserved",
                        "reservation_ends_at": reservation.reservation_ends_at,
                        "checked_at": reservation.updated_at.isoformat(),
                        "raw_payload": {
                            "source": "reservation_service",
                            "reservation_id": reservation.id,
                            "provider_status": reservation.provider_status,
                        },
                    },
                ],
            },
        )
        response.raise_for_status()


def seed_reserved_status_best_effort(client: StatusServiceClient, reservation: Reservation) -> None:
    try:
        client.seed_reserved_status(reservation)
    except httpx.HTTPError as exc:
        logger.warning(
            "Failed to seed reserved status cache for %s:%s after reservation %s: %s",
            reservation.provider_code,
            reservation.external_point_id,
            reservation.id,
            exc.__class__.__name__,
        )
