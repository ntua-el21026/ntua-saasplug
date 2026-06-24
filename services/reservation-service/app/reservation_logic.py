import math
from datetime import timezone, datetime, timedelta
from hashlib import sha256
import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.catalog_client import CatalogServiceClient, CatalogServiceError
from app.config import PROVIDER_CODES
from app.models import (
    Reservation,
    ReservationAttempt,
    ReservationEventOutbox,
    ReservationIdempotencyRecord,
    ReservationPointLock,
    new_id,
    utcnow,
)
from app.provider_client import ProviderServiceClient, ProviderServiceError
from app.schemas import (
    CatalogPointDTO,
    CurrentPrincipal,
    OutboxEventResponse,
    ProviderReservationDTO,
    ReservationAttemptResponse,
    ReservationResponse,
)


ESTIMATE_BASIS_RATED_POWER = "rated_power_duration_estimate"
POINT_LOCK_TTL_SECONDS = 5 * 60
PROVIDER_AVAILABILITY_CONFLICT_EXTERNAL_CODES = {400, 404, 409}
PROVIDER_AVAILABILITY_CONFLICT_TYPES = {
    "provider_already_reserved",
    "provider_unavailable",
    "provider_conflict",
    "point_already_reserved",
    "point_unavailable",
}
CHARGER_UNAVAILABLE_MESSAGE = "This charger is no longer available. Refresh status or choose another point."


class ReservationFlowError(Exception):
    def __init__(self, status_code: int, detail: dict[str, Any]) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class ReservationReplay(Exception):
    def __init__(self, reservation: Reservation) -> None:
        super().__init__(reservation.id)
        self.reservation = reservation


def validate_provider_code(provider_code: str) -> None:
    if provider_code not in PROVIDER_CODES:
        raise ValueError(f"Unsupported provider code: {provider_code}")


def normalize_idempotency_key(idempotency_key: str | None) -> str | None:
    if idempotency_key is None:
        return None
    normalized = idempotency_key.strip()
    if not normalized:
        return None
    if len(normalized) > 128:
        raise ReservationFlowError(
            400,
            {
                "error_type": "invalid_idempotency_key",
                "message": "Idempotency key must be 128 characters or fewer",
            },
        )
    return normalized


def reservation_request_fingerprint(
    principal: CurrentPrincipal,
    provider_code: str,
    external_point_id: str,
    duration_minutes: int,
) -> str:
    payload = {
        "user_id": principal.sub,
        "provider_code": provider_code,
        "external_point_id": external_point_id,
        "duration_minutes": duration_minutes,
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return sha256(serialized.encode("utf-8")).hexdigest()


def ensure_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


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
        charger_capacity_kw=reservation.charger_capacity_kw,
        estimated_energy_kwh=reservation.estimated_energy_kwh,
        estimated_cost_eur=reservation.estimated_cost_eur,
        estimated_cost_currency=reservation.estimated_cost_currency,
        estimate_basis=reservation.estimate_basis,
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
        publish_attempts=event.publish_attempts,
        last_publish_error=event.last_publish_error,
        last_publish_attempt_at=event.last_publish_attempt_at.isoformat()
        if event.last_publish_attempt_at
        else None,
        published_at=event.published_at.isoformat() if event.published_at else None,
        created_at=event.created_at.isoformat(),
    )


def is_provider_availability_conflict(error: ProviderServiceError) -> bool:
    if error.error_type in PROVIDER_AVAILABILITY_CONFLICT_TYPES:
        return True
    return error.external_status_code in PROVIDER_AVAILABILITY_CONFLICT_EXTERNAL_CODES


def safe_provider_failure_message(error_type: str, external_status_code: int | None = None) -> str:
    if error_type in PROVIDER_AVAILABILITY_CONFLICT_TYPES or external_status_code in PROVIDER_AVAILABILITY_CONFLICT_EXTERNAL_CODES:
        return CHARGER_UNAVAILABLE_MESSAGE
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


def positive_float(value: float | int | None) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number <= 0:
        return None
    return number


def non_negative_float(value: float | int | None) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number < 0:
        return None
    return number


def estimate_energy_kwh(capacity_kw: float | None, duration_minutes: int) -> float | None:
    valid_capacity = positive_float(capacity_kw)
    valid_duration = positive_float(duration_minutes)
    if valid_capacity is None or valid_duration is None:
        return None
    return round(valid_capacity * valid_duration / 60, 4)


def estimate_cost_eur(price_per_kwh_eur: float | None, capacity_kw: float | None, duration_minutes: int) -> tuple[float | None, float | None, str | None, str | None]:
    valid_price = non_negative_float(price_per_kwh_eur)
    energy_kwh = estimate_energy_kwh(capacity_kw, duration_minutes)
    if valid_price is None or energy_kwh is None:
        return energy_kwh, None, None, None
    return energy_kwh, round(valid_price * energy_kwh, 2), "EUR", ESTIMATE_BASIS_RATED_POWER


def resolve_price_per_kwh(point: CatalogPointDTO, provider_reservation: ProviderReservationDTO | None = None) -> float | None:
    if provider_reservation:
        provider_price = non_negative_float(provider_reservation.price_per_kwh_eur)
        if provider_price is not None:
            return provider_price
    return non_negative_float(point.price_per_kwh_eur)


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


def get_or_create_idempotency_record(
    db: Session,
    principal: CurrentPrincipal,
    provider_code: str,
    external_point_id: str,
    duration_minutes: int,
    idempotency_key: str | None,
) -> ReservationIdempotencyRecord | None:
    normalized_key = normalize_idempotency_key(idempotency_key)
    if normalized_key is None:
        return None

    fingerprint = reservation_request_fingerprint(principal, provider_code, external_point_id, duration_minutes)
    existing = db.scalar(
        select(ReservationIdempotencyRecord).where(
            ReservationIdempotencyRecord.idempotency_key == normalized_key,
        ),
    )
    if existing is not None:
        if existing.user_id != principal.sub or existing.request_fingerprint != fingerprint:
            raise ReservationFlowError(
                409,
                {
                    "error_type": "idempotency_key_conflict",
                    "message": "Idempotency key was already used for a different reservation request",
                },
            )
        if existing.status == "in_progress":
            raise ReservationFlowError(
                409,
                {
                    "error_type": "reservation_request_in_progress",
                    "message": "Reservation request is already in progress",
                },
            )
        if existing.reservation_id:
            reservation = db.get(Reservation, existing.reservation_id)
            if reservation is not None and existing.status == "succeeded":
                raise ReservationReplay(reservation)
        if existing.error_detail and existing.response_status_code:
            raise ReservationFlowError(existing.response_status_code, existing.error_detail)
        raise ReservationFlowError(
            409,
            {
                "error_type": "idempotency_key_replay_unavailable",
                "message": "The previous reservation result for this key is unavailable",
            },
        )

    record = ReservationIdempotencyRecord(
        idempotency_key=normalized_key,
        request_fingerprint=fingerprint,
        user_id=principal.sub,
        provider_code=provider_code,
        external_point_id=external_point_id,
        requested_duration_minutes=duration_minutes,
        status="in_progress",
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        return get_or_create_idempotency_record(
            db,
            principal,
            provider_code,
            external_point_id,
            duration_minutes,
            normalized_key,
        )
    db.refresh(record)
    return record


def complete_idempotency_with_reservation(
    db: Session,
    record: ReservationIdempotencyRecord | None,
    reservation: Reservation,
    status_code: int,
) -> None:
    if record is None:
        return
    record.status = reservation.status
    record.reservation_id = reservation.id
    record.response_status_code = status_code
    record.response_payload = reservation_response(reservation).model_dump(mode="json")
    record.error_detail = None
    db.commit()


def complete_idempotency_with_error(
    db: Session,
    record: ReservationIdempotencyRecord | None,
    status_code: int,
    detail: dict[str, Any],
    *,
    status_value: str = "failed",
    reservation: Reservation | None = None,
) -> None:
    if record is None:
        return
    record.status = status_value
    record.reservation_id = reservation.id if reservation else None
    record.response_status_code = status_code
    record.response_payload = reservation_response(reservation).model_dump(mode="json") if reservation else None
    record.error_detail = detail
    db.commit()


def acquire_point_lock(db: Session, provider_code: str, external_point_id: str, owner_id: str) -> bool:
    normalized_point_id = f"{provider_code}:{external_point_id}"
    now = utcnow()
    existing = db.get(ReservationPointLock, normalized_point_id)
    if existing is not None:
        if ensure_aware_utc(existing.expires_at) > now:
            return False
        db.delete(existing)
        db.flush()

    db.add(
        ReservationPointLock(
            normalized_point_id=normalized_point_id,
            provider_code=provider_code,
            external_point_id=external_point_id,
            owner_id=owner_id,
            acquired_at=now,
            expires_at=now + timedelta(seconds=POINT_LOCK_TTL_SECONDS),
        ),
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    return True


def release_point_lock(db: Session, provider_code: str, external_point_id: str, owner_id: str) -> None:
    normalized_point_id = f"{provider_code}:{external_point_id}"
    lock = db.get(ReservationPointLock, normalized_point_id)
    if lock is None or lock.owner_id != owner_id:
        return
    db.delete(lock)
    db.commit()


def reservation_end_is_active(value: str | None) -> bool:
    if value is None:
        return True
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return True
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed > utcnow()


def active_successful_reservation_exists(db: Session, provider_code: str, external_point_id: str) -> bool:
    reservations = db.scalars(
        select(Reservation).where(
            Reservation.provider_code == provider_code,
            Reservation.external_point_id == external_point_id,
            Reservation.status == "succeeded",
        ),
    ).all()
    return any(reservation_end_is_active(reservation.reservation_ends_at) for reservation in reservations)


def create_provider_call_attempt(
    db: Session,
    principal: CurrentPrincipal,
    point: CatalogPointDTO,
    duration_minutes: int,
) -> ReservationAttempt:
    attempt = base_attempt(principal, point.provider_code, point.external_point_id, duration_minutes)
    attempt.normalized_point_id = point.normalized_point_id
    attempt.provider_called = True
    attempt.result_status = "provider_call_started"
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def record_local_conflict_attempt(
    db: Session,
    principal: CurrentPrincipal,
    point: CatalogPointDTO,
    duration_minutes: int,
    error_type: str,
    message: str,
) -> None:
    attempt = base_attempt(principal, point.provider_code, point.external_point_id, duration_minutes)
    attempt.normalized_point_id = point.normalized_point_id
    attempt.provider_error_type = error_type
    attempt.provider_error_message = message
    attempt.external_status_code = 409
    attempt.completed_at = utcnow()
    db.add(attempt)
    db.commit()


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
        "charger_capacity_kw": reservation.charger_capacity_kw,
        "estimated_energy_kwh": reservation.estimated_energy_kwh,
        "estimated_cost_eur": reservation.estimated_cost_eur,
        "estimated_cost_currency": reservation.estimated_cost_currency,
        "estimate_basis": reservation.estimate_basis,
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
    attempt: ReservationAttempt | None = None,
) -> Reservation:
    price_per_kwh_eur = resolve_price_per_kwh(point, provider_reservation)
    charger_capacity_kw = positive_float(point.capacity)
    energy_kwh, estimated_cost_eur, estimate_currency, estimate_basis = estimate_cost_eur(
        price_per_kwh_eur,
        charger_capacity_kw,
        duration_minutes,
    )
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
        price_per_kwh_eur=price_per_kwh_eur,
        charger_capacity_kw=charger_capacity_kw,
        estimated_energy_kwh=energy_kwh,
        estimated_cost_eur=estimated_cost_eur,
        estimated_cost_currency=estimate_currency,
        estimate_basis=estimate_basis,
        raw_provider_payload=sanitize_payload(provider_reservation.raw_payload),
    )
    db.add(reservation)
    db.flush()

    if attempt is None:
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
    attempt: ReservationAttempt | None = None,
) -> Reservation:
    result_status = "unknown" if error.ambiguous_outcome or error.error_type == "provider_timeout" else "failed"
    safe_message = safe_provider_failure_message(error.error_type, error.external_status_code)
    reservation = Reservation(
        user_id=principal.sub,
        user_email=principal.email,
        provider_code=point.provider_code,
        external_point_id=point.external_point_id,
        normalized_point_id=point.normalized_point_id,
        catalog_point_id=point.id,
        requested_duration_minutes=duration_minutes,
        status=result_status,
        price_per_kwh_eur=non_negative_float(point.price_per_kwh_eur),
        charger_capacity_kw=positive_float(point.capacity),
        failure_reason=safe_message,
    )
    db.add(reservation)
    db.flush()

    if attempt is None:
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
    idempotency_key: str | None = None,
) -> Reservation:
    validate_provider_code(provider_code)
    idempotency_record = get_or_create_idempotency_record(
        db,
        principal,
        provider_code,
        external_point_id,
        duration_minutes,
        idempotency_key,
    )
    try:
        point = require_catalog_point_available(
            db,
            principal,
            provider_code,
            external_point_id,
            duration_minutes,
            catalog_client,
        )
    except ReservationFlowError as exc:
        complete_idempotency_with_error(db, idempotency_record, exc.status_code, exc.detail)
        raise

    lock_owner_id = idempotency_record.id if idempotency_record is not None else new_id()
    lock_acquired = acquire_point_lock(db, provider_code, external_point_id, lock_owner_id)
    if not lock_acquired:
        detail = {
            "provider_code": provider_code,
            "external_point_id": external_point_id,
            "error_type": "reservation_request_in_progress",
            "message": "Reservation request is already in progress for this point",
        }
        complete_idempotency_with_error(db, idempotency_record, 409, detail, status_value="conflict")
        raise ReservationFlowError(409, detail)

    attempt: ReservationAttempt | None = None
    try:
        if active_successful_reservation_exists(db, provider_code, external_point_id):
            record_local_conflict_attempt(
                db,
                principal,
                point,
                duration_minutes,
                "reservation_already_active",
                CHARGER_UNAVAILABLE_MESSAGE,
            )
            detail = {
                "provider_code": provider_code,
                "external_point_id": external_point_id,
                "error_type": "reservation_already_active",
                "message": CHARGER_UNAVAILABLE_MESSAGE,
            }
            complete_idempotency_with_error(db, idempotency_record, 409, detail, status_value="conflict")
            raise ReservationFlowError(409, detail)

        attempt = create_provider_call_attempt(db, principal, point, duration_minutes)
        try:
            provider_reservation = provider_client.reserve_point(provider_code, external_point_id, duration_minutes)
        except ProviderServiceError as exc:
            reservation = create_failed_reservation(db, principal, point, duration_minutes, exc, attempt)
            status_code = 504 if exc.error_type == "provider_timeout" else 502
            if is_provider_availability_conflict(exc):
                status_code = 409
            detail = {
                "provider_code": provider_code,
                "external_point_id": external_point_id,
                "reservation_id": reservation.id,
                "error_type": exc.error_type,
                "message": safe_provider_failure_message(exc.error_type, exc.external_status_code),
                "external_status_code": exc.external_status_code,
            }
            complete_idempotency_with_error(
                db,
                idempotency_record,
                status_code,
                detail,
                status_value=reservation.status,
                reservation=reservation,
            )
            raise ReservationFlowError(status_code, detail) from exc

        try:
            reservation = create_successful_reservation(
                db,
                principal,
                point,
                duration_minutes,
                provider_reservation,
                attempt,
            )
        except SQLAlchemyError as exc:
            db.rollback()
            persistence_detail = {
                "provider_code": provider_code,
                "external_point_id": external_point_id,
                "error_type": "local_persistence_failed_after_provider_success",
                "message": "Provider reservation succeeded but local persistence failed",
            }
            persisted_attempt = db.get(ReservationAttempt, attempt.id) if attempt is not None else None
            if persisted_attempt is not None:
                persisted_attempt.result_status = "unknown"
                persisted_attempt.provider_error_type = "local_persistence_failed_after_provider_success"
                persisted_attempt.provider_error_message = persistence_detail["message"]
                persisted_attempt.completed_at = utcnow()
                db.commit()
            complete_idempotency_with_error(
                db,
                idempotency_record,
                500,
                persistence_detail,
                status_value="persistence_failed",
            )
            raise ReservationFlowError(500, persistence_detail) from exc

        complete_idempotency_with_reservation(db, idempotency_record, reservation, 201)
        return reservation
    finally:
        release_point_lock(db, provider_code, external_point_id, lock_owner_id)
