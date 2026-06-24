from datetime import datetime, timedelta, timezone
import threading
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import PROVIDER_CODES, Settings
from app.models import StatusCache, StatusCachePolicy, StatusCheckLog, utcnow
from app.provider_client import ProviderServiceClient, ProviderServiceError
from app.schemas import CurrentPrincipal, ProviderStatusDTO, StatusLookupResponse

ALLOWED_STATUSES = {"available", "charging", "reserved", "malfunction", "offline", "unknown"}
_REFRESH_LOCKS: dict[tuple[str, str], threading.Lock] = {}
_REFRESH_LOCKS_GUARD = threading.Lock()
CACHE_POLICY_ID = "default"


def validate_provider_code(provider_code: str) -> None:
    if provider_code not in PROVIDER_CODES:
        raise ValueError(f"Unsupported provider code: {provider_code}")


def normalize_status(status_value: str | None) -> str:
    if not status_value:
        return "unknown"
    normalized = status_value.strip().lower()
    return normalized if normalized in ALLOWED_STATUSES else "unknown"


def normalized_point_id(provider_code: str, external_point_id: str) -> str:
    return f"{provider_code}:{external_point_id}"


def ensure_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def get_cache(db: Session, provider_code: str, external_point_id: str) -> StatusCache | None:
    return db.scalar(
        select(StatusCache).where(
            StatusCache.provider_code == provider_code,
            StatusCache.external_point_id == external_point_id,
        ),
    )


def ensure_cache_policy(db: Session, default_ttl_seconds: int) -> StatusCachePolicy:
    policy = db.get(StatusCachePolicy, CACHE_POLICY_ID)
    if policy is None:
        policy = StatusCachePolicy(id=CACHE_POLICY_ID, ttl_seconds=default_ttl_seconds)
        db.add(policy)
        db.commit()
        db.refresh(policy)
    return policy


def update_cache_policy(db: Session, *, ttl_seconds: int, default_ttl_seconds: int) -> StatusCachePolicy:
    policy = ensure_cache_policy(db, default_ttl_seconds)
    policy.ttl_seconds = ttl_seconds
    for cache in db.scalars(select(StatusCache)).all():
        cache.expires_at = ensure_aware_utc(cache.last_checked_at) + timedelta(seconds=ttl_seconds)
    db.commit()
    db.refresh(policy)
    return policy


def refresh_lock_for(provider_code: str, external_point_id: str) -> threading.Lock:
    key = (provider_code, external_point_id)
    with _REFRESH_LOCKS_GUARD:
        lock = _REFRESH_LOCKS.get(key)
        if lock is None:
            lock = threading.Lock()
            _REFRESH_LOCKS[key] = lock
        return lock


def status_response(
    cache: StatusCache,
    *,
    cache_hit: bool,
    provider_called: bool,
    returned_stale: bool,
    source: str,
    warning: str | None = None,
) -> StatusLookupResponse:
    return StatusLookupResponse(
        provider_code=cache.provider_code,
        external_point_id=cache.external_point_id,
        normalized_point_id=cache.normalized_point_id,
        status=cache.status,
        reservation_ends_at=cache.reservation_ends_at,
        checked_at=cache.last_checked_at.isoformat(),
        expires_at=cache.expires_at.isoformat(),
        cache_hit=cache_hit,
        provider_called=provider_called,
        returned_stale=returned_stale,
        source=source,
        warning=warning,
    )


def write_log(
    db: Session,
    *,
    provider_code: str,
    external_point_id: str,
    principal: CurrentPrincipal,
    cache_hit: bool,
    force_refresh: bool,
    result_status: str | None,
    returned_stale: bool,
    provider_called: bool,
    provider_error_type: str | None = None,
    provider_error_message: str | None = None,
    external_status_code: int | None = None,
) -> StatusCheckLog:
    log = StatusCheckLog(
        provider_code=provider_code,
        external_point_id=external_point_id,
        normalized_point_id=normalized_point_id(provider_code, external_point_id),
        requested_by_user_id=principal.sub,
        requested_by_email=principal.email,
        requested_by_roles=principal.roles,
        requested_by_provider_code=principal.provider_code,
        cache_hit=cache_hit,
        force_refresh=force_refresh,
        result_status=result_status,
        returned_stale=returned_stale,
        provider_called=provider_called,
        provider_error_type=provider_error_type,
        provider_error_message=provider_error_message,
        external_status_code=external_status_code,
    )
    db.add(log)
    return log


def raw_payload_from_status(status_dto: ProviderStatusDTO) -> dict[str, Any]:
    return status_dto.model_dump()


def upsert_cache(
    db: Session,
    *,
    provider_status: ProviderStatusDTO,
    settings: Settings,
) -> StatusCache:
    now = utcnow()
    policy = ensure_cache_policy(db, settings.cache_ttl_seconds)
    expires_at = now + timedelta(seconds=policy.ttl_seconds)
    provider_code = provider_status.provider_code
    external_point_id = str(provider_status.external_point_id)
    cache = get_cache(db, provider_code, external_point_id)
    if cache is None:
        cache = StatusCache(
            provider_code=provider_code,
            external_point_id=external_point_id,
            normalized_point_id=normalized_point_id(provider_code, external_point_id),
            expires_at=expires_at,
            raw_provider_payload={},
        )
        db.add(cache)
        db.flush()
    cache.normalized_point_id = normalized_point_id(provider_code, external_point_id)
    cache.status = normalize_status(provider_status.status)
    cache.reservation_ends_at = provider_status.reservation_ends_at
    cache.last_checked_at = now
    cache.expires_at = expires_at
    cache.source = "provider_live"
    cache.raw_provider_payload = raw_payload_from_status(provider_status)
    cache.last_error_type = None
    cache.last_error_message = None
    return cache


def lookup_status(
    db: Session,
    *,
    provider_code: str,
    external_point_id: str,
    force_refresh: bool,
    principal: CurrentPrincipal,
    settings: Settings,
    provider_client: ProviderServiceClient,
) -> StatusLookupResponse:
    validate_provider_code(provider_code)
    cache = get_cache(db, provider_code, external_point_id)
    now = utcnow()
    if cache is not None and ensure_aware_utc(cache.expires_at) > now and not force_refresh:
        write_log(
            db,
            provider_code=provider_code,
            external_point_id=external_point_id,
            principal=principal,
            cache_hit=True,
            force_refresh=False,
            result_status=cache.status,
            returned_stale=False,
            provider_called=False,
        )
        db.commit()
        return status_response(
            cache,
            cache_hit=True,
            provider_called=False,
            returned_stale=False,
            source="cache",
        )

    with refresh_lock_for(provider_code, external_point_id):
        db.expire_all()
        cache = get_cache(db, provider_code, external_point_id)
        now = utcnow()
        if cache is not None and ensure_aware_utc(cache.expires_at) > now and not force_refresh:
            write_log(
                db,
                provider_code=provider_code,
                external_point_id=external_point_id,
                principal=principal,
                cache_hit=True,
                force_refresh=False,
                result_status=cache.status,
                returned_stale=False,
                provider_called=False,
            )
            db.commit()
            return status_response(
                cache,
                cache_hit=True,
                provider_called=False,
                returned_stale=False,
                source="cache",
            )

        try:
            provider_status = provider_client.get_status(provider_code, external_point_id)
            if provider_status.provider_code != provider_code:
                raise ProviderServiceError(
                    provider_code,
                    "provider_invalid_response",
                    "Provider status response had wrong provider code",
                )
            if provider_status.normalized_point_id != normalized_point_id(provider_code, external_point_id):
                raise ProviderServiceError(
                    provider_code,
                    "provider_invalid_response",
                    "Provider status response had invalid normalized point id",
                )
            cache = upsert_cache(db, provider_status=provider_status, settings=settings)
            write_log(
                db,
                provider_code=provider_code,
                external_point_id=external_point_id,
                principal=principal,
                cache_hit=False,
                force_refresh=force_refresh,
                result_status=cache.status,
                returned_stale=False,
                provider_called=True,
            )
            db.commit()
            db.refresh(cache)
            return status_response(
                cache,
                cache_hit=False,
                provider_called=True,
                returned_stale=False,
                source="provider_live",
            )
        except ProviderServiceError as exc:
            if cache is not None:
                cache.last_error_type = exc.error_type
                cache.last_error_message = exc.message
                cache.source = "cache_fallback"
                write_log(
                    db,
                    provider_code=provider_code,
                    external_point_id=external_point_id,
                    principal=principal,
                    cache_hit=False,
                    force_refresh=force_refresh,
                    result_status=cache.status,
                    returned_stale=True,
                    provider_called=True,
                    provider_error_type=exc.error_type,
                    provider_error_message=exc.message,
                    external_status_code=exc.external_status_code,
                )
                db.commit()
                db.refresh(cache)
                return status_response(
                    cache,
                    cache_hit=False,
                    provider_called=True,
                    returned_stale=True,
                    source="cache_fallback",
                    warning="Provider status lookup failed; returning last known cached status.",
                )
            write_log(
                db,
                provider_code=provider_code,
                external_point_id=external_point_id,
                principal=principal,
                cache_hit=False,
                force_refresh=force_refresh,
                result_status=None,
                returned_stale=False,
                provider_called=True,
                provider_error_type=exc.error_type,
                provider_error_message=exc.message,
                external_status_code=exc.external_status_code,
            )
            db.commit()
            raise
