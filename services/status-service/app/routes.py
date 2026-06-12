from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import PROVIDER_CODES, Settings, get_settings
from app.database import get_db
from app.models import StatusCache, StatusCheckLog, utcnow
from app.provider_client import ProviderServiceClient, ProviderServiceError
from app.schemas import (
    CurrentPrincipal,
    ProviderFreshnessResponse,
    StatusCacheResponse,
    StatusCheckLogResponse,
    StatusLookupResponse,
)
from app.security import ensure_log_reader, get_current_principal
from app.status_logic import get_cache, lookup_status, validate_provider_code

router = APIRouter(tags=["status"])


def cache_response(cache: StatusCache) -> StatusCacheResponse:
    return StatusCacheResponse(
        provider_code=cache.provider_code,
        external_point_id=cache.external_point_id,
        normalized_point_id=cache.normalized_point_id,
        status=cache.status,
        reservation_ends_at=cache.reservation_ends_at,
        last_checked_at=cache.last_checked_at.isoformat(),
        expires_at=cache.expires_at.isoformat(),
        source=cache.source,
        last_error_type=cache.last_error_type,
        last_error_message=cache.last_error_message,
    )


def log_response(log: StatusCheckLog) -> StatusCheckLogResponse:
    return StatusCheckLogResponse(
        id=log.id,
        provider_code=log.provider_code,
        external_point_id=log.external_point_id,
        normalized_point_id=log.normalized_point_id,
        requested_by_user_id=log.requested_by_user_id,
        requested_by_email=log.requested_by_email,
        requested_by_roles=log.requested_by_roles,
        requested_by_provider_code=log.requested_by_provider_code,
        cache_hit=log.cache_hit,
        force_refresh=log.force_refresh,
        result_status=log.result_status,
        returned_stale=log.returned_stale,
        provider_called=log.provider_called,
        provider_error_type=log.provider_error_type,
        provider_error_message=log.provider_error_message,
        external_status_code=log.external_status_code,
        checked_at=log.checked_at.isoformat(),
    )


@router.get("/points/{provider_code}/{external_point_id}/status", response_model=StatusLookupResponse)
def read_point_status(
    provider_code: str,
    external_point_id: str,
    force_refresh: bool = Query(default=False, alias="forceRefresh"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> StatusLookupResponse:
    try:
        validate_provider_code(provider_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    provider_client = ProviderServiceClient(settings)
    try:
        return lookup_status(
            db,
            provider_code=provider_code,
            external_point_id=external_point_id,
            force_refresh=force_refresh,
            principal=principal,
            settings=settings,
            provider_client=provider_client,
        )
    except ProviderServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "provider_code": provider_code,
                "external_point_id": external_point_id,
                "error_type": exc.error_type,
                "message": "Provider status lookup failed",
                "external_status_code": exc.external_status_code,
            },
        ) from exc
    finally:
        provider_client.close()


@router.get("/points/{provider_code}/{external_point_id}", response_model=StatusLookupResponse)
def read_point_status_alias(
    provider_code: str,
    external_point_id: str,
    force_refresh: bool = Query(default=False, alias="forceRefresh"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> StatusLookupResponse:
    return read_point_status(
        provider_code,
        external_point_id,
        force_refresh,
        db,
        settings,
        principal,
    )


@router.get("/cache/{provider_code}/{external_point_id}", response_model=StatusCacheResponse)
def read_cached_status(
    provider_code: str,
    external_point_id: str,
    db: Session = Depends(get_db),
    _: CurrentPrincipal = Depends(get_current_principal),
) -> StatusCacheResponse:
    try:
        validate_provider_code(provider_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    cache = get_cache(db, provider_code, external_point_id)
    if cache is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status cache entry not found")
    return cache_response(cache)


@router.get("/logs", response_model=list[StatusCheckLogResponse])
def list_logs(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    external_point_id: str | None = Query(default=None, alias="externalPointId"),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[StatusCheckLogResponse]:
    ensure_log_reader(principal)
    query = select(StatusCheckLog)
    if "PROVIDER_ADMIN" in principal.roles and "OPERATOR" not in principal.roles:
        query = query.where(StatusCheckLog.provider_code == principal.provider_code)
    elif provider_code:
        try:
            validate_provider_code(provider_code)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        query = query.where(StatusCheckLog.provider_code == provider_code)
    if external_point_id:
        query = query.where(StatusCheckLog.external_point_id == external_point_id)
    logs = db.scalars(query.order_by(StatusCheckLog.checked_at.desc()).limit(limit)).all()
    return [log_response(log) for log in logs]


@router.get("/freshness", response_model=list[ProviderFreshnessResponse])
def read_freshness(db: Session = Depends(get_db)) -> list[ProviderFreshnessResponse]:
    now = utcnow()
    freshness: list[ProviderFreshnessResponse] = []
    for provider_code in PROVIDER_CODES:
        cached_count = db.scalar(
            select(func.count())
            .select_from(StatusCache)
            .where(StatusCache.provider_code == provider_code),
        ) or 0
        valid_cache_count = db.scalar(
            select(func.count())
            .select_from(StatusCache)
            .where(StatusCache.provider_code == provider_code, StatusCache.expires_at > now),
        ) or 0
        expired_cache_count = db.scalar(
            select(func.count())
            .select_from(StatusCache)
            .where(StatusCache.provider_code == provider_code, StatusCache.expires_at <= now),
        ) or 0
        last_log = db.scalar(
            select(StatusCheckLog)
            .where(StatusCheckLog.provider_code == provider_code)
            .order_by(StatusCheckLog.checked_at.desc())
            .limit(1),
        )
        freshness.append(
            ProviderFreshnessResponse(
                provider_code=provider_code,
                cached_count=cached_count,
                valid_cache_count=valid_cache_count,
                expired_cache_count=expired_cache_count,
                last_checked_at=last_log.checked_at.isoformat() if last_log else None,
                last_log_status=last_log.result_status if last_log else None,
                last_error_type=last_log.provider_error_type if last_log else None,
            ),
        )
    return freshness
