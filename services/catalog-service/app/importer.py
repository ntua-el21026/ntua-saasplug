from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import PROVIDER_CODES
from app.models import CatalogImportLock, CatalogImportRun, CatalogPoint, CatalogPointChange, utcnow
from app.provider_client import ProviderServiceClient, ProviderServiceError
from app.schemas import ImportSummaryResponse, ProviderPointDTO

ALLOWED_STATUSES = {"available", "charging", "reserved", "malfunction", "offline", "unknown"}
SENSITIVE_KEY_PARTS = (
    "secret",
    "api_key",
    "apikey",
    "authorization",
    "password",
    "credential",
    "token",
)
IMPORT_LOCK_TTL_SECONDS = 30 * 60


def validate_provider_code(provider_code: str) -> None:
    if provider_code not in PROVIDER_CODES:
        raise ValueError(f"Unsupported provider code: {provider_code}")


def parse_datetime(value: str | None) -> datetime:
    if not value:
        return utcnow()
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return utcnow()
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def ensure_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def normalize_status(status_value: str | None) -> str:
    if not status_value:
        return "unknown"
    normalized = status_value.strip().lower()
    return normalized if normalized in ALLOWED_STATUSES else "unknown"


def synthetic_coordinates(provider_code: str, external_point_id: str) -> tuple[float, float]:
    digest = sha256(f"{provider_code}:{external_point_id}".encode("utf-8")).digest()
    lat_offset = int.from_bytes(digest[:2], "big") / 65535 * 0.12
    lng_offset = int.from_bytes(digest[2:4], "big") / 65535 * 0.16
    return round(37.93 + lat_offset, 6), round(23.66 + lng_offset, 6)


def sanitize_payload(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized = {}
        for key, item in value.items():
            key_text = str(key)
            lower_key = key_text.lower()
            if any(part in lower_key for part in SENSITIVE_KEY_PARTS):
                sanitized[key_text] = "[redacted]"
            else:
                sanitized[key_text] = sanitize_payload(item)
        return sanitized
    if isinstance(value, list):
        return [sanitize_payload(item) for item in value]
    return value


def import_summary(import_run: CatalogImportRun) -> ImportSummaryResponse:
    return ImportSummaryResponse(
        run_id=import_run.id,
        provider_code=import_run.provider_code,
        status=import_run.status,
        provider_sync_triggered=import_run.provider_sync_triggered,
        provider_fetched_count=import_run.provider_fetched_count,
        catalog_upserted_count=import_run.catalog_upserted_count,
        catalog_changed_count=import_run.catalog_changed_count,
        catalog_marked_stale_count=import_run.catalog_marked_stale_count,
        error_message=import_run.error_message,
    )


def point_values(provider_point: ProviderPointDTO) -> dict[str, Any]:
    external_point_id = str(provider_point.external_point_id)
    provider_code = provider_point.provider_code
    normalized_point_id = f"{provider_code}:{external_point_id}"
    latitude, longitude = synthetic_coordinates(provider_code, external_point_id)
    display_name = provider_point.location_name or f"{provider_code} point {external_point_id}"
    return {
        "normalized_point_id": normalized_point_id,
        "provider_code": provider_code,
        "external_point_id": external_point_id,
        "display_name": display_name,
        "location_name": provider_point.location_name,
        "address": provider_point.address,
        "latitude": latitude,
        "longitude": longitude,
        "coordinate_source": "demo_synthetic",
        "status": normalize_status(provider_point.status),
        "reservation_ends_at": provider_point.reservation_ends_at,
        "price_per_kwh_eur": provider_point.price_per_kwh_eur,
        "capacity": provider_point.capacity,
        "connector": provider_point.connector,
        "is_active": True,
        "is_stale": False,
        "last_provider_seen_at": parse_datetime(provider_point.last_seen_at),
        "raw_provider_payload": sanitize_payload(provider_point.raw_payload),
    }


def changed_fields_for(point: CatalogPoint, values: dict[str, Any]) -> dict[str, dict[str, Any]]:
    changed: dict[str, dict[str, Any]] = {}
    tracked_fields = (
        "display_name",
        "location_name",
        "address",
        "latitude",
        "longitude",
        "coordinate_source",
        "status",
        "reservation_ends_at",
        "price_per_kwh_eur",
        "capacity",
        "connector",
        "is_active",
        "is_stale",
        "raw_provider_payload",
    )
    for field in tracked_fields:
        old_value = getattr(point, field)
        new_value = values[field]
        if old_value != new_value:
            changed[field] = {"old": old_value, "new": new_value}
    return changed


def record_point_change(db: Session, point: CatalogPoint, changed_fields: dict[str, Any]) -> None:
    db.add(
        CatalogPointChange(
            provider_code=point.provider_code,
            external_point_id=point.external_point_id,
            normalized_point_id=point.normalized_point_id,
            changed_fields=changed_fields,
        ),
    )


def acquire_provider_import_lock(db: Session, provider_code: str, owner_run_id: str) -> bool:
    now = utcnow()
    existing = db.get(CatalogImportLock, provider_code)
    if existing is not None:
        if ensure_aware_utc(existing.expires_at) > now:
            return False
        db.delete(existing)
        db.flush()

    db.add(
        CatalogImportLock(
            provider_code=provider_code,
            owner_run_id=owner_run_id,
            acquired_at=now,
            expires_at=now + timedelta(seconds=IMPORT_LOCK_TTL_SECONDS),
        ),
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    return True


def release_provider_import_lock(db: Session, provider_code: str, owner_run_id: str) -> None:
    lock = db.get(CatalogImportLock, provider_code)
    if lock is None or lock.owner_run_id != owner_run_id:
        return
    db.delete(lock)
    db.commit()


def upsert_catalog_point(db: Session, provider_point: ProviderPointDTO, sync_time: datetime) -> bool:
    values = point_values(provider_point)
    if values["provider_code"] != provider_point.provider_code:
        raise ValueError("Provider code mismatch")
    point = db.scalar(
        select(CatalogPoint).where(
            CatalogPoint.provider_code == values["provider_code"],
            CatalogPoint.external_point_id == values["external_point_id"],
        ),
    )
    if point is None:
        point = CatalogPoint(**values, last_catalog_sync_at=sync_time)
        db.add(point)
        db.flush()
        record_point_change(db, point, {"created": True})
        return True

    changed_fields = changed_fields_for(point, values)
    for field, value in values.items():
        setattr(point, field, value)
    point.last_catalog_sync_at = sync_time
    if changed_fields:
        record_point_change(db, point, changed_fields)
        return True
    return False


def mark_missing_points_stale(
    db: Session,
    provider_code: str,
    seen_external_ids: set[str],
    sync_time: datetime,
) -> int:
    stale_count = 0
    existing_points = db.scalars(
        select(CatalogPoint).where(CatalogPoint.provider_code == provider_code),
    ).all()
    for point in existing_points:
        if point.external_point_id in seen_external_ids:
            continue
        if point.is_active or not point.is_stale:
            changed_fields = {
                "is_active": {"old": point.is_active, "new": False},
                "is_stale": {"old": point.is_stale, "new": True},
            }
            point.is_active = False
            point.is_stale = True
            point.last_catalog_sync_at = sync_time
            record_point_change(db, point, changed_fields)
            stale_count += 1
    return stale_count


def import_provider_catalog(
    db: Session,
    provider_code: str,
    triggered_by: str | None,
    provider_client: ProviderServiceClient,
) -> ImportSummaryResponse:
    validate_provider_code(provider_code)
    sync_time = utcnow()
    import_run = CatalogImportRun(
        provider_code=provider_code,
        status="running",
        triggered_by=triggered_by,
    )
    db.add(import_run)
    db.commit()
    db.refresh(import_run)
    lock_acquired = acquire_provider_import_lock(db, provider_code, import_run.id)
    if not lock_acquired:
        import_run.status = "skipped"
        import_run.completed_at = utcnow()
        import_run.error_message = "Catalog import is already running for this provider"
        db.commit()
        db.refresh(import_run)
        return import_summary(import_run)

    try:
        import_run.provider_sync_triggered = True
        db.commit()
        sync_summary = provider_client.sync_provider(provider_code)
        import_run.provider_fetched_count = sync_summary.fetched_count
        provider_points = provider_client.list_points(provider_code)
        seen_external_ids: set[str] = set()
        changed_count = 0
        with db.begin_nested():
            for provider_point in provider_points:
                if provider_point.provider_code != provider_code:
                    raise ProviderServiceError(provider_code, "Provider point list contained wrong provider code")
                if provider_point.normalized_point_id != f"{provider_code}:{provider_point.external_point_id}":
                    raise ProviderServiceError(provider_code, "Provider point normalized id was invalid")
                seen_external_ids.add(str(provider_point.external_point_id))
                if upsert_catalog_point(db, provider_point, sync_time):
                    changed_count += 1

            stale_count = mark_missing_points_stale(db, provider_code, seen_external_ids, sync_time)
        import_run.status = "completed"
        import_run.completed_at = utcnow()
        import_run.provider_fetched_count = len(provider_points)
        import_run.catalog_upserted_count = len(provider_points)
        import_run.catalog_changed_count = changed_count
        import_run.catalog_marked_stale_count = stale_count
        db.commit()
        db.refresh(import_run)
        return import_summary(import_run)
    except (ProviderServiceError, ValueError) as exc:
        import_run.status = "failed"
        import_run.completed_at = utcnow()
        import_run.error_message = str(exc)
        db.commit()
        db.refresh(import_run)
        return import_summary(import_run)
    finally:
        release_provider_import_lock(db, provider_code, import_run.id)
