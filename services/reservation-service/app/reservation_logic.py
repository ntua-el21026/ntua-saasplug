from typing import Any

from sqlalchemy.orm import Session

from app.catalog_client import CatalogServiceClient, CatalogServiceError
from app.config import PROVIDER_CODES
from app.models import Reservation, ReservationAttempt, ReservationEventOutbox, utcnow
from app.provider_client import ProviderServiceClient, ProviderServiceError
from app.schemas import (
    CatalogPointDTO,
    CurrentPrincipal,
    OutboxEventResponse,
    ProviderReservationDTO,
    ReservationAttemptResponse,
    ReservationResponse,
)


class ReservationFlowError(Exception):
    def __init__(self, status_code: int, detail: dict[str, Any]) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


def validate_provider_code(provider_code: str) -> None:
    if provider_code not in PROVIDER_CODES:
        raise ValueError(f"Unsupported provider code: {provider_code}")


def reservation_response(reservation: Reservation) -> ReservationResponse:
    return ReservationResponse(
        id=reservation.id,
        user_id=reservation.user_id,
        user_email=reservation.user_email,
        provider_code=reservation.provider_code,
        external_point_id=reservation.external_point_id,
        normalized_point_id=reservation.normalized_point_id,
        catalog_point_id=reservation.catalog_point_id,
        requested_duration_minutes=reservation.requested_duration_minutes,
        status=reservation.status,
        provider_status=reservation.provider_status,
        provider_reservation_id=reservation.provider_reservation_id,
        reservation_ends_at=reservation.reservation_ends_at,
        price_per_kwh_eur=reservation.price_per_kwh_eur,
        failure_reason=reservation.failure_reason,
        created_at=reservation.created_at.isoformat(),
        updated_at=reservation.updated_at.isoformat(),
    )


def attempt_response(attempt: ReservationAttempt) -> ReservationAttemptResponse:
    return ReservationAttemptResponse(
        id=attempt.id,
        reservation_id=attempt.reservation_id,
        user_id=attempt.user_id,
        user_email=attempt.user_email,
        requested_by_roles=attempt.requested_by_roles,
        requested_by_provider_code=attempt.requested_by_provider_code,
        provider_code=attempt.provider_code,
        external_point_id=attempt.external_point_id,
        normalized_point_id=attempt.normalized_point_id,
        requested_duration_minutes=attempt.requested_duration_minutes,
        provider_called=attempt.provider_called,
        result_status=attempt.result_status,
        provider_error_type=attempt.provider_error_type,
        provider_error_message=attempt.provider_error_message,
        external_status_code=attempt.external_status_code,
        started_at=attempt.started_at.isoformat(),
        completed_at=attempt.completed_at.isoformat() if attempt.completed_at else None,
    )


def outbox_response(event: ReservationEventOutbox) -> OutboxEventResponse:
    return OutboxEventResponse(
        id=event.id,
        event_id=event.event_id,
        event_type=event.event_type,
        event_version=event.event_version,
        correlation_id=event.correlation_id,
        aggregate_id=event.aggregate_id,
        provider_code=event.provider_code,
        user_id=event.user_id,
        occurred_at=event.occurred_at.isoformat(),
        producer=event.producer,
        payload=event.payload,
        publish_status=event.publish_status,
        published_at=event.published_at.isoformat() if event.published_at else None,
        created_at=event.created_at.isoformat(),
    )


def safe_provider_failure_message(error_type: str) -> str:
    if error_type == "provider_timeout":
        return "Provider reservation outcome unknown"
    return "Provider reservation request failed"


def sanitize_payload(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for key, item in value.items():
            lower_key = str(key).lower()
            if any(secret_word in lower_key for secret_word in ("secret", "token", "password", "api_key", "apikey")):
                sanitized[str(key)] = "[redacted]"
            else:
                sanitized[str(key)] = sanitize_payload(item)
        return sanitized
    if isinstance(value, list):
        return [sanitize_payload(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def base_attempt(
    principal: CurrentPrincipal,
    provider_code: str,
    external_point_id: str,
    duration_minutes: int,
) -> ReservationAttempt:
    return ReservationAttempt(
        user_id=principal.sub,
        user_email=principal.email,
        requested_by_roles=principal.roles,
        requested_by_provider_code=principal.provider_code,
        provider_code=provider_code,
        external_point_id=external_point_id,
        requested_duration_minutes=duration_minutes,
        provider_called=False,
        result_status="failed",
        started_at=utcnow(),
    )


def add_outbox_event(
    db: Session,
    reservation: Reservation,
    event_type: str,
    payload: dict[str, Any],
) -> ReservationEventOutbox:
    event = ReservationEventOutbox(
        event_type=event_type,
        correlation_id=reservation.id,
        aggregate_id=reservation.id,
        provider_code=reservation.provider_code,
        user_id=reservation.user_id,
        payload=payload,
        publish_status="pending",
    )
    db.add(event)
    return event


def success_payload(reservation: Reservation) -> dict[str, Any]:
    return {
        "reservation_id": reservation.id,
        "user_id": reservation.user_id,
        "provider_code": reservation.provider_code,
        "external_point_id": reservation.external_point_id,
        "normalized_point_id": reservation.normalized_point_id,
        "requested_duration_minutes": reservation.requested_duration_minutes,
        "status": reservation.status,
        "provider_status": reservation.provider_status,
        "provider_reservation_id": reservation.provider_reservation_id,
        "reservation_ends_at": reservation.reservation_ends_at,
        "price_per_kwh_eur": reservation.price_per_kwh_eur,
    }


def failure_payload(reservation: Reservation, error_type: str) -> dict[str, Any]:
    payload = success_payload(reservation)
    payload["error_type"] = error_type
    payload["failure_reason"] = reservation.failure_reason
    return payload


def record_catalog_failure_attempt(
    db: Session,
    principal: CurrentPrincipal,
    provider_code: str,
    external_point_id: str,
    duration_minutes: int,
    error_type: str,
    message: str,
    status_code: int,
) -> None:
    attempt = base_attempt(principal, provider_code, external_point_id, duration_minutes)
    attempt.provider_error_type = error_type
    attempt.provider_error_message = message
    attempt.external_status_code = status_code
    attempt.completed_at = utcnow()
    db.add(attempt)
    db.commit()


def require_catalog_point_available(
    db: Session,
    principal: CurrentPrincipal,
    provider_code: str,
    external_point_id: str,
    duration_minutes: int,
    catalog_client: CatalogServiceClient,
) -> CatalogPointDTO:
    try:
        point = catalog_client.get_point(provider_code, external_point_id)
    except CatalogServiceError as exc:
        status_code = 404 if exc.error_type == "catalog_point_not_found" else 502
        record_catalog_failure_attempt(
            db,
            principal,
            provider_code,
            external_point_id,
            duration_minutes,
            exc.error_type,
            "Catalog point resolution failed",
            exc.status_code or status_code,
        )
        raise ReservationFlowError(
            status_code,
            {
                "provider_code": provider_code,
                "external_point_id": external_point_id,
                "error_type": exc.error_type,
                "message": "Catalog point is not available for reservation",
            },
        ) from exc

    if not point.is_active or point.is_stale:
        record_catalog_failure_attempt(
            db,
            principal,
            provider_code,
            external_point_id,
            duration_minutes,
            "catalog_point_unavailable",
            "Catalog point is inactive or stale",
            409,
        )
        raise ReservationFlowError(
            409,
            {
                "provider_code": provider_code,
                "external_point_id": external_point_id,
                "error_type": "catalog_point_unavailable",
                "message": "Catalog point is not available for reservation",
            },
        )
    return point


def create_successful_reservation(
    db: Session,
    principal: CurrentPrincipal,
    point: CatalogPointDTO,
    duration_minutes: int,
    provider_reservation: ProviderReservationDTO,
) -> Reservation:
    reservation = Reservation(
        user_id=principal.sub,
        user_email=principal.email,
        provider_code=point.provider_code,
        external_point_id=point.external_point_id,
        normalized_point_id=point.normalized_point_id,
        catalog_point_id=point.id,
        requested_duration_minutes=duration_minutes,
        status="succeeded",
        provider_status=provider_reservation.status,
        provider_reservation_id=provider_reservation.provider_reservation_id,
        reservation_ends_at=provider_reservation.reservation_ends_at,
        price_per_kwh_eur=provider_reservation.price_per_kwh_eur,
        raw_provider_payload=sanitize_payload(provider_reservation.raw_payload),
    )
    db.add(reservation)
    db.flush()

    attempt = base_attempt(principal, point.provider_code, point.external_point_id, duration_minutes)
    attempt.reservation_id = reservation.id
    attempt.normalized_point_id = point.normalized_point_id
    attempt.provider_called = True
    attempt.result_status = "succeeded"
    attempt.completed_at = utcnow()
    db.add(attempt)
    add_outbox_event(db, reservation, "reservation.succeeded", success_payload(reservation))
    db.commit()
    db.refresh(reservation)
    return reservation


def create_failed_reservation(
    db: Session,
    principal: CurrentPrincipal,
    point: CatalogPointDTO,
    duration_minutes: int,
    error: ProviderServiceError,
) -> Reservation:
    result_status = "unknown" if error.ambiguous_outcome or error.error_type == "provider_timeout" else "failed"
    safe_message = safe_provider_failure_message(error.error_type)
    reservation = Reservation(
        user_id=principal.sub,
        user_email=principal.email,
        provider_code=point.provider_code,
        external_point_id=point.external_point_id,
        normalized_point_id=point.normalized_point_id,
        catalog_point_id=point.id,
        requested_duration_minutes=duration_minutes,
        status=result_status,
        failure_reason=safe_message,
    )
    db.add(reservation)
    db.flush()

    attempt = base_attempt(principal, point.provider_code, point.external_point_id, duration_minutes)
    attempt.reservation_id = reservation.id
    attempt.normalized_point_id = point.normalized_point_id
    attempt.provider_called = True
    attempt.result_status = result_status
    attempt.provider_error_type = error.error_type
    attempt.provider_error_message = safe_message
    attempt.external_status_code = error.external_status_code
    attempt.completed_at = utcnow()
    db.add(attempt)
    add_outbox_event(db, reservation, "reservation.failed", failure_payload(reservation, error.error_type))
    db.commit()
    db.refresh(reservation)
    return reservation


def create_reservation(
    db: Session,
    principal: CurrentPrincipal,
    provider_code: str,
    external_point_id: str,
    duration_minutes: int,
    catalog_client: CatalogServiceClient,
    provider_client: ProviderServiceClient,
) -> Reservation:
    validate_provider_code(provider_code)
    point = require_catalog_point_available(
        db,
        principal,
        provider_code,
        external_point_id,
        duration_minutes,
        catalog_client,
    )
    try:
        provider_reservation = provider_client.reserve_point(provider_code, external_point_id, duration_minutes)
    except ProviderServiceError as exc:
        reservation = create_failed_reservation(db, principal, point, duration_minutes, exc)
        status_code = 504 if exc.error_type == "provider_timeout" else 502
        raise ReservationFlowError(
            status_code,
            {
                "provider_code": provider_code,
                "external_point_id": external_point_id,
                "reservation_id": reservation.id,
                "error_type": exc.error_type,
                "message": safe_provider_failure_message(exc.error_type),
                "external_status_code": exc.external_status_code,
            },
        ) from exc

    return create_successful_reservation(db, principal, point, duration_minutes, provider_reservation)
