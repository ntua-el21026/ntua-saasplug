from datetime import datetime, timezone
from typing import Any

from app import provider_config
from app.client import ProviderClientError
from app.schemas import NormalizedPointResponse, NormalizedReservationResponse, StatusResponse

INTERNAL_STATUSES = {"available", "charging", "reserved", "malfunction", "offline", "unknown"}
STATUS_ALIASES = {
    "available": "available",
    "free": "available",
    "idle": "available",
    "ready": "available",
    "charging": "charging",
    "in_use": "charging",
    "in-use": "charging",
    "occupied": "charging",
    "reserved": "reserved",
    "held": "reserved",
    "hold": "reserved",
    "malfunction": "malfunction",
    "faulted": "malfunction",
    "broken": "malfunction",
    "error": "malfunction",
    "out_of_order": "malfunction",
    "out-of-order": "malfunction",
    "offline": "offline",
    "disconnected": "offline",
}


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalized_point_id(provider_code: str, external_point_id: str) -> str:
    return f"{provider_code}:{external_point_id}"


def normalize_status(raw_status: Any) -> str:
    if raw_status is None:
        return "unknown"
    value = str(raw_status).strip().lower()
    return STATUS_ALIASES.get(value, value if value in INTERNAL_STATUSES else "unknown")


def external_point_id_from_payload(payload: dict[str, Any]) -> str:
    raw_id = payload.get(provider_config.POINT_ID_FIELD)
    if raw_id is None:
        raise ProviderClientError(
            "provider_validation_error",
            "Provider point payload is missing its point identifier",
        )
    return str(raw_id)


def normalize_point_payload(payload: dict[str, Any], provider_code: str) -> NormalizedPointResponse:
    external_point_id = external_point_id_from_payload(payload)
    price = payload.get(provider_config.PRICE_FIELD) if provider_config.PRICE_FIELD else None
    return NormalizedPointResponse(
        provider_code=provider_code,
        external_point_id=external_point_id,
        normalized_point_id=normalized_point_id(provider_code, external_point_id),
        status=normalize_status(payload.get(provider_config.STATUS_FIELD)),
        reservation_ends_at=payload.get(provider_config.RESERVATION_END_FIELD),
        price_per_kwh_eur=price,
        capacity=payload.get("cap"),
        connector=payload.get("connector"),
        location_name=payload.get("locationName"),
        address=payload.get("address"),
        raw_payload=payload,
        last_seen_at=utc_iso(),
    )


def normalize_status_payload(payload: dict[str, Any], provider_code: str) -> StatusResponse:
    point = normalize_point_payload(payload, provider_code)
    return StatusResponse(
        provider_code=point.provider_code,
        external_point_id=point.external_point_id,
        normalized_point_id=point.normalized_point_id,
        status=point.status,
        reservation_ends_at=point.reservation_ends_at,
        checked_at=utc_iso(),
    )


def normalize_reservation_payload(
    payload: dict[str, Any],
    provider_code: str,
) -> NormalizedReservationResponse:
    external_point_id = external_point_id_from_payload(payload)
    reservation_ends_at = payload.get(provider_config.RESERVATION_END_FIELD)
    if not reservation_ends_at:
        raise ProviderClientError(
            "provider_validation_error",
            "Provider reservation response is missing reservation end time",
        )
    price = payload.get(provider_config.PRICE_FIELD) if provider_config.PRICE_FIELD else None
    reservation_id = (
        payload.get(provider_config.RESERVATION_ID_FIELD)
        if provider_config.RESERVATION_ID_FIELD
        else None
    )
    return NormalizedReservationResponse(
        provider_code=provider_code,
        external_point_id=external_point_id,
        normalized_point_id=normalized_point_id(provider_code, external_point_id),
        provider_reservation_id=str(reservation_id) if reservation_id is not None else None,
        status=normalize_status(payload.get(provider_config.STATUS_FIELD)),
        reservation_ends_at=reservation_ends_at,
        price_per_kwh_eur=price,
        raw_payload=payload,
    )
