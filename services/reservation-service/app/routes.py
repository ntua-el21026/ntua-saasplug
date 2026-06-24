from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.catalog_client import CatalogServiceClient
from app.config import Settings, get_settings
from app.database import get_db
from app.event_publisher import build_rabbitmq_publisher, publish_pending_outbox
from app.models import Reservation, ReservationAttempt, ReservationEventOutbox
from app.provider_client import ProviderServiceClient
from app.reservation_logic import (
    ReservationFlowError,
    ReservationReplay,
    attempt_response,
    create_reservation,
    outbox_response,
    reservation_response,
    validate_provider_code,
)
from app.schemas import (
    CurrentPrincipal,
    OutboxEventResponse,
    OutboxPublishResponse,
    ReservationAttemptResponse,
    ReservationCreateRequest,
    ReservationResponse,
)
from app.security import (
    ensure_can_read_reservation,
    ensure_operator,
    ensure_provider_admin_or_operator,
    ensure_reservation_creator,
    get_current_principal,
    is_operator,
    is_provider_admin,
)

router = APIRouter(tags=["reservations"])


def require_scheduler_token(
    x_scheduler_token: str | None = Header(default=None, alias="X-Scheduler-Token"),
    settings: Settings = Depends(get_settings),
) -> None:
    if not x_scheduler_token or x_scheduler_token != settings.scheduler_internal_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid scheduler token")


def require_scheduler_job(
    x_job_run_id: str | None = Header(default=None, alias="X-Job-Run-Id"),
    _: None = Depends(require_scheduler_token),
) -> str:
    if not x_job_run_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing scheduler job run id")
    return x_job_run_id


def get_reservation_or_404(db: Session, reservation_id: str) -> Reservation:
    reservation = db.get(Reservation, reservation_id)
    if reservation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    return reservation


@router.post(
    "/points/{provider_code}/{external_point_id}/reservations",
    response_model=ReservationResponse,
    status_code=status.HTTP_201_CREATED,
)
def reserve_point(
    provider_code: str,
    external_point_id: str,
    request: ReservationCreateRequest | None = None,
    idempotency_key_header: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ReservationResponse:
    ensure_reservation_creator(principal)
    duration_minutes = request.duration_minutes if request is not None else 60
    request_idempotency_key = request.idempotency_key if request is not None else None
    if (
        idempotency_key_header
        and request_idempotency_key
        and idempotency_key_header.strip() != request_idempotency_key.strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_type": "idempotency_key_conflict",
                "message": "Idempotency key header and request body value differ",
            },
        )
    idempotency_key = idempotency_key_header or request_idempotency_key
    try:
        validate_provider_code(provider_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    catalog_client = CatalogServiceClient(settings)
    provider_client = ProviderServiceClient(settings)
    try:
        reservation = create_reservation(
            db,
            principal,
            provider_code,
            external_point_id,
            duration_minutes,
            catalog_client,
            provider_client,
            idempotency_key,
        )
        return reservation_response(reservation)
    except ReservationReplay as replay:
        return reservation_response(replay.reservation)
    except ReservationFlowError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    finally:
        catalog_client.close()
        provider_client.close()


@router.get("/reservations/me", response_model=list[ReservationResponse])
def list_my_reservations(
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[ReservationResponse]:
    reservations = db.scalars(
        select(Reservation)
        .where(Reservation.user_id == principal.sub)
        .order_by(Reservation.created_at.desc())
        .limit(limit),
    ).all()
    return [reservation_response(reservation) for reservation in reservations]


@router.get("/reservations", response_model=list[ReservationResponse])
def list_reservations(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[ReservationResponse]:
    ensure_provider_admin_or_operator(principal)
    query = select(Reservation)
    if is_provider_admin(principal) and not is_operator(principal):
        query = query.where(Reservation.provider_code == principal.provider_code)
    elif provider_code:
        try:
            validate_provider_code(provider_code)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        query = query.where(Reservation.provider_code == provider_code)
    reservations = db.scalars(query.order_by(Reservation.created_at.desc()).limit(limit)).all()
    return [reservation_response(reservation) for reservation in reservations]


@router.get("/reservations/{reservation_id}", response_model=ReservationResponse)
def read_reservation(
    reservation_id: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ReservationResponse:
    reservation = get_reservation_or_404(db, reservation_id)
    ensure_can_read_reservation(principal, reservation)
    return reservation_response(reservation)


@router.get("/reservations/{reservation_id}/attempts", response_model=list[ReservationAttemptResponse])
def list_reservation_attempts(
    reservation_id: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[ReservationAttemptResponse]:
    reservation = get_reservation_or_404(db, reservation_id)
    ensure_can_read_reservation(principal, reservation)
    attempts = db.scalars(
        select(ReservationAttempt)
        .where(ReservationAttempt.reservation_id == reservation_id)
        .order_by(ReservationAttempt.started_at.desc()),
    ).all()
    return [attempt_response(attempt) for attempt in attempts]


@router.get("/attempts", response_model=list[ReservationAttemptResponse])
def list_attempts(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[ReservationAttemptResponse]:
    ensure_provider_admin_or_operator(principal)
    query = select(ReservationAttempt)
    if is_provider_admin(principal) and not is_operator(principal):
        query = query.where(ReservationAttempt.provider_code == principal.provider_code)
    elif provider_code:
        try:
            validate_provider_code(provider_code)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        query = query.where(ReservationAttempt.provider_code == provider_code)
    attempts = db.scalars(query.order_by(ReservationAttempt.started_at.desc()).limit(limit)).all()
    return [attempt_response(attempt) for attempt in attempts]


@router.get("/events/outbox", response_model=list[OutboxEventResponse])
def list_outbox_events(
    publish_status: str | None = Query(default=None, alias="publishStatus"),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[OutboxEventResponse]:
    ensure_operator(principal)
    query = select(ReservationEventOutbox)
    if publish_status:
        query = query.where(ReservationEventOutbox.publish_status == publish_status)
    events = db.scalars(query.order_by(ReservationEventOutbox.created_at.desc()).limit(limit)).all()
    return [outbox_response(event) for event in events]


@router.post("/events/outbox/publish-pending", response_model=OutboxPublishResponse)
def publish_pending_outbox_events(
    limit: int | None = Query(default=None, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> OutboxPublishResponse:
    ensure_operator(principal)
    batch_size = limit or settings.reservation_outbox_publish_batch_size
    publisher = build_rabbitmq_publisher(settings)
    try:
        result = publish_pending_outbox(db, publisher, batch_size)
    finally:
        publisher.close()
    return OutboxPublishResponse(
        selected_count=result.selected_count,
        published_count=result.published_count,
        failed_count=result.failed_count,
        skipped_count=result.skipped_count,
        published_event_ids=result.published_event_ids,
        failed_event_ids=result.failed_event_ids,
    )


@router.post("/internal/jobs/outbox/publish-pending", response_model=OutboxPublishResponse)
def publish_pending_outbox_from_scheduler(
    limit: int | None = Query(default=None, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: str = Depends(require_scheduler_job),
) -> OutboxPublishResponse:
    batch_size = limit or settings.reservation_outbox_publish_batch_size
    publisher = build_rabbitmq_publisher(settings)
    try:
        result = publish_pending_outbox(db, publisher, batch_size)
    finally:
        publisher.close()
    return OutboxPublishResponse(
        selected_count=result.selected_count,
        published_count=result.published_count,
        failed_count=result.failed_count,
        skipped_count=result.skipped_count,
        published_event_ids=result.published_event_ids,
        failed_event_ids=result.failed_event_ids,
    )


@router.get("/internal/jobs/freshness")
def read_internal_freshness(
    db: Session = Depends(get_db),
    _: str = Depends(require_scheduler_job),
) -> dict:
    pending_outbox_count = db.scalar(
        select(func.count()).select_from(ReservationEventOutbox).where(ReservationEventOutbox.publish_status == "pending"),
    ) or 0
    last_outbox_at = db.scalar(select(func.max(ReservationEventOutbox.created_at)))
    last_published_at = db.scalar(select(func.max(ReservationEventOutbox.published_at)))
    return {
        "pending_outbox_count": pending_outbox_count,
        "last_outbox_at": last_outbox_at.isoformat() if last_outbox_at else None,
        "last_published_at": last_published_at.isoformat() if last_published_at else None,
    }
