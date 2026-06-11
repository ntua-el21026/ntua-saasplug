import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProviderPointChange, ProviderPointSnapshot, RawProviderPayload
from app.schemas import NormalizedPointResponse


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def payload_hash(payload: dict) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def snapshot_to_response(snapshot: ProviderPointSnapshot) -> NormalizedPointResponse:
    return NormalizedPointResponse(
        provider_code=snapshot.provider_code,
        external_point_id=snapshot.external_point_id,
        normalized_point_id=snapshot.normalized_point_id,
        status=snapshot.status,
        reservation_ends_at=snapshot.reservation_ends_at,
        price_per_kwh_eur=snapshot.price_per_kwh_eur,
        capacity=snapshot.capacity,
        connector=snapshot.connector,
        location_name=snapshot.location_name,
        address=snapshot.address,
        raw_payload=snapshot.raw_payload,
        last_seen_at=snapshot.last_seen_at.isoformat(),
    )


def store_raw_payload(
    db: Session,
    provider_code: str,
    endpoint: str,
    payload: dict | list,
    status_code: int | None,
    external_point_id: str | None = None,
) -> None:
    db.add(
        RawProviderPayload(
            provider_code=provider_code,
            endpoint=endpoint,
            external_point_id=external_point_id,
            payload=payload,
            status_code=status_code,
        ),
    )


def upsert_snapshot(db: Session, point: NormalizedPointResponse) -> bool:
    existing = db.scalar(
        select(ProviderPointSnapshot).where(
            ProviderPointSnapshot.normalized_point_id == point.normalized_point_id,
        ),
    )
    new_hash = payload_hash(point.raw_payload)
    values = {
        "status": point.status,
        "reservation_ends_at": point.reservation_ends_at,
        "price_per_kwh_eur": point.price_per_kwh_eur,
        "capacity": point.capacity,
        "connector": point.connector,
        "location_name": point.location_name,
        "address": point.address,
        "raw_payload": point.raw_payload,
        "payload_hash": new_hash,
    }
    if existing is None:
        db.add(
            ProviderPointSnapshot(
                provider_code=point.provider_code,
                external_point_id=point.external_point_id,
                normalized_point_id=point.normalized_point_id,
                last_seen_at=utcnow(),
                **values,
            ),
        )
        db.add(
            ProviderPointChange(
                provider_code=point.provider_code,
                external_point_id=point.external_point_id,
                normalized_point_id=point.normalized_point_id,
                change_type="created",
                changed_fields=values,
            ),
        )
        return True

    changed_fields = {}
    for field, value in values.items():
        old_value = getattr(existing, field)
        if old_value != value:
            changed_fields[field] = {"old": old_value, "new": value}
            setattr(existing, field, value)
    existing.last_seen_at = utcnow()
    existing.is_active = True
    if changed_fields:
        db.add(
            ProviderPointChange(
                provider_code=point.provider_code,
                external_point_id=point.external_point_id,
                normalized_point_id=point.normalized_point_id,
                change_type="updated",
                changed_fields=changed_fields,
            ),
        )
        return True
    return False
