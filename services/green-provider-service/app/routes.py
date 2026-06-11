from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.client import ProviderClientError, ProviderHttpClient
from app.config import Settings, get_settings
from app.database import get_db
from app.models import ProviderPointSnapshot, ProviderSyncRun, utcnow
from app.normalization import (
    external_point_id_from_payload,
    normalize_point_payload,
    normalize_reservation_payload,
    normalize_status_payload,
)
from app.schemas import (
    NormalizedPointResponse,
    NormalizedReservationResponse,
    ProviderIdentityResponse,
    ReservationRequest,
    StatusResponse,
    SyncRunResponse,
    SyncSummaryResponse,
)
from app.storage import snapshot_to_response, store_raw_payload, upsert_snapshot

router = APIRouter(prefix="/internal", tags=["provider-internal"])


def provider_error(error: ProviderClientError, settings: Settings) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=error.to_response(settings.provider_code),
    )


def sync_run_response(sync_run: ProviderSyncRun) -> SyncRunResponse:
    return SyncRunResponse(
        id=sync_run.id,
        provider_code=sync_run.provider_code,
        status=sync_run.status,
        started_at=sync_run.started_at.isoformat(),
        completed_at=sync_run.completed_at.isoformat() if sync_run.completed_at else None,
        fetched_count=sync_run.fetched_count,
        upserted_count=sync_run.upserted_count,
        failed_count=sync_run.failed_count,
        error_message=sync_run.error_message,
    )


@router.get("/provider", response_model=ProviderIdentityResponse)
def provider_identity(settings: Settings = Depends(get_settings)) -> ProviderIdentityResponse:
    return ProviderIdentityResponse(
        provider_code=settings.provider_code,
        service_name=settings.service_name,
        api_base_url=settings.provider_base_url,
        api_key_env_var=settings.api_key_env_var,
        secret_configured_elsewhere=bool(settings.api_key_env_var),
    )


@router.get("/points", response_model=list[NormalizedPointResponse])
def list_local_points(db: Session = Depends(get_db)) -> list[NormalizedPointResponse]:
    snapshots = db.scalars(
        select(ProviderPointSnapshot).order_by(ProviderPointSnapshot.external_point_id),
    ).all()
    return [snapshot_to_response(snapshot) for snapshot in snapshots]


@router.post("/sync", response_model=SyncSummaryResponse)
def sync_points(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SyncSummaryResponse:
    sync_run = ProviderSyncRun(provider_code=settings.provider_code, status="running")
    db.add(sync_run)
    db.commit()
    db.refresh(sync_run)

    client = ProviderHttpClient(settings)
    try:
        result = client.list_points()
        if not isinstance(result.payload, list):
            raise ProviderClientError(
                "provider_unexpected_response",
                "Provider list endpoint did not return a JSON array",
                result.status_code,
            )
        fetched_count = len(result.payload)
        upserted_count = 0
        failed_count = 0
        store_raw_payload(
            db,
            settings.provider_code,
            result.endpoint,
            result.payload,
            result.status_code,
        )
        for raw_point in result.payload:
            if not isinstance(raw_point, dict):
                failed_count += 1
                continue
            try:
                external_point_id = external_point_id_from_payload(raw_point)
                point = normalize_point_payload(raw_point, settings.provider_code)
            except ProviderClientError:
                failed_count += 1
                continue
            store_raw_payload(
                db,
                settings.provider_code,
                result.endpoint,
                raw_point,
                result.status_code,
                external_point_id,
            )
            if upsert_snapshot(db, point):
                upserted_count += 1
        sync_run.status = "completed"
        sync_run.completed_at = utcnow()
        sync_run.fetched_count = fetched_count
        sync_run.upserted_count = upserted_count
        sync_run.failed_count = failed_count
        db.commit()
        return SyncSummaryResponse(
            provider_code=settings.provider_code,
            status=sync_run.status,
            fetched_count=fetched_count,
            upserted_count=upserted_count,
            failed_count=failed_count,
        )
    except ProviderClientError as exc:
        sync_run.status = "failed"
        sync_run.completed_at = utcnow()
        sync_run.error_message = exc.message
        db.commit()
        raise provider_error(exc, settings) from exc
    finally:
        client.close()


@router.get("/points/{external_point_id}", response_model=NormalizedPointResponse)
def fetch_point(
    external_point_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> NormalizedPointResponse:
    client = ProviderHttpClient(settings)
    try:
        result = client.get_point(external_point_id)
        if not isinstance(result.payload, dict):
            raise ProviderClientError(
                "provider_unexpected_response",
                "Provider detail endpoint did not return a JSON object",
                result.status_code,
            )
        point = normalize_point_payload(result.payload, settings.provider_code)
        store_raw_payload(
            db,
            settings.provider_code,
            result.endpoint,
            result.payload,
            result.status_code,
            point.external_point_id,
        )
        upsert_snapshot(db, point)
        db.commit()
        return point
    except ProviderClientError as exc:
        raise provider_error(exc, settings) from exc
    finally:
        client.close()


@router.get("/points/{external_point_id}/status", response_model=StatusResponse)
def fetch_status(
    external_point_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> StatusResponse:
    client = ProviderHttpClient(settings)
    try:
        result = client.get_status(external_point_id)
        if not isinstance(result.payload, dict):
            raise ProviderClientError(
                "provider_unexpected_response",
                "Provider status endpoint did not return a JSON object",
                result.status_code,
            )
        point = normalize_point_payload(result.payload, settings.provider_code)
        status_response = normalize_status_payload(result.payload, settings.provider_code)
        store_raw_payload(
            db,
            settings.provider_code,
            result.endpoint,
            result.payload,
            result.status_code,
            point.external_point_id,
        )
        upsert_snapshot(db, point)
        db.commit()
        return status_response
    except ProviderClientError as exc:
        raise provider_error(exc, settings) from exc
    finally:
        client.close()


@router.post("/points/{external_point_id}/reservations", response_model=NormalizedReservationResponse)
def reserve_point(
    external_point_id: str,
    request: ReservationRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> NormalizedReservationResponse:
    client = ProviderHttpClient(settings)
    try:
        result = client.reserve_point(external_point_id, request.duration_minutes)
        if not isinstance(result.payload, dict):
            raise ProviderClientError(
                "provider_unexpected_response",
                "Provider reservation endpoint did not return a JSON object",
                result.status_code,
            )
        reservation = normalize_reservation_payload(result.payload, settings.provider_code)
        store_raw_payload(
            db,
            settings.provider_code,
            result.endpoint,
            result.payload,
            result.status_code,
            reservation.external_point_id,
        )
        db.commit()
        return reservation
    except ProviderClientError as exc:
        raise provider_error(exc, settings) from exc
    finally:
        client.close()


@router.get("/sync-runs", response_model=list[SyncRunResponse])
def list_sync_runs(db: Session = Depends(get_db)) -> list[SyncRunResponse]:
    sync_runs = db.scalars(
        select(ProviderSyncRun).order_by(ProviderSyncRun.started_at.desc()).limit(25),
    ).all()
    return [sync_run_response(sync_run) for sync_run in sync_runs]
