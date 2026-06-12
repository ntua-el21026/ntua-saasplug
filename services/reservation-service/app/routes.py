from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog_client import CatalogServiceClient
from app.config import Settings, get_settings
from app.database import get_db
from app.models import Reservation, ReservationAttempt, ReservationEventOutbox
from app.provider_client import ProviderServiceClient
from app.reservation_logic import (
    ReservationFlowError,
    attempt_response,
    create_reservation,
    outbox_response,
    reservation_response,
    validate_provider_code,
)
from app.schemas import (
    CurrentPrincipal,
    OutboxEventResponse,
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
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ReservationResponse:
    ensure_reservation_creator(principal)
    duration_minutes = request.duration_minutes if request is not None else 60
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
        )
        return reservation_response(reservation)
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
