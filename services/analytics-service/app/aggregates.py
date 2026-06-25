from dataclasses import dataclass
from datetime import UTC, datetime
import math
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    EvReservationDailyMetric,
    OperatorDailyMetric,
    PointDailyMetric,
    ProviderDailyMetric,
    ProviderHourlyMetric,
    ProviderStatusDailyMetric,
    UsageEvent,
    utcnow,
)
from saasplug_events.routing import EventType


@dataclass(frozen=True)
class AggregateRefreshResult:
    usage_event_count: int
    provider_hourly_rows: int
    provider_daily_rows: int
    point_daily_rows: int
    provider_status_daily_rows: int
    operator_daily_rows: int
    ev_reservation_daily_rows: int
    refreshed_at: datetime


def refresh_aggregates(db: Session) -> AggregateRefreshResult:
    refreshed_at = utcnow()
    clear_aggregate_tables(db)
    events = db.scalars(select(UsageEvent).order_by(UsageEvent.occurred_at.asc())).all()

    provider_hourly: dict[tuple[str, datetime], dict] = {}
    provider_daily: dict[tuple[str, object], dict] = {}
    point_daily: dict[tuple[str, object, str | None, str | None], dict] = {}
    point_view_status_daily: dict[tuple[str, object, str], int] = {}
    operator_daily: dict[object, dict] = {}
    ev_reservation_daily: dict[tuple[str, object], dict] = {}

    for event in events:
        event_day = event.occurred_at.date()
        event_hour = hour_bucket(event.occurred_at)

        operator_bucket = operator_daily.setdefault(event_day, empty_operator_bucket())
        apply_operator_event(operator_bucket, event)
        if event.user_id and event.event_type in {
            EventType.RESERVATION_SUCCEEDED.value,
            EventType.RESERVATION_FAILED.value,
        }:
            ev_bucket = ev_reservation_daily.setdefault(
                (event.user_id, event_day),
                empty_ev_reservation_bucket(event.user_id, event_day),
            )
            apply_ev_reservation_event(ev_bucket, event)

        for provider_code in provider_codes_for_provider_aggregates(event):
            provider_hour_bucket = provider_hourly.setdefault(
                (provider_code, event_hour),
                empty_provider_bucket(provider_code, event_hour),
            )
            provider_day_bucket = provider_daily.setdefault(
                (provider_code, event_day),
                empty_provider_bucket(provider_code, event_day),
            )
            apply_provider_event(provider_hour_bucket, event)
            apply_provider_event(provider_day_bucket, event)

        if event.provider_code:
            if event.internal_point_id or event.external_point_id:
                point_key = (
                    event.provider_code,
                    event_day,
                    event.internal_point_id,
                    event.external_point_id,
                )
                point_bucket = point_daily.setdefault(
                    point_key,
                    {
                        "provider_code": event.provider_code,
                        "day_bucket": event_day,
                        "internal_point_id": event.internal_point_id,
                        "external_point_id": event.external_point_id,
                        "point_name": event.point_name,
                        "point_views": 0,
                        "successful_reservations": 0,
                        "failed_reservations": 0,
                        "status_checks": 0,
                    },
                )
                if not point_bucket["point_name"] and event.point_name:
                    point_bucket["point_name"] = event.point_name
                apply_point_event(point_bucket, event)

            status_value = point_view_status_from_event(event)
            if status_value is not None:
                status_key = (event.provider_code, event_day, status_value)
                point_view_status_daily[status_key] = point_view_status_daily.get(status_key, 0) + 1

    for bucket in provider_hourly.values():
        db.add(
            ProviderHourlyMetric(
                provider_code=bucket["provider_code"],
                hour_bucket=bucket["bucket"],
                searches=bucket["searches"],
                point_views=bucket["point_views"],
                status_checks=bucket["status_checks"],
                status_cache_hits=bucket["status_cache_hits"],
                status_provider_calls=bucket["status_provider_calls"],
                successful_reservations=bucket["successful_reservations"],
                failed_reservations=bucket["failed_reservations"],
                observed_amount=bucket["observed_amount"],
                currency=bucket["currency"],
                last_computed_at=refreshed_at,
            ),
        )

    for bucket in provider_daily.values():
        db.add(
            ProviderDailyMetric(
                provider_code=bucket["provider_code"],
                day_bucket=bucket["bucket"],
                searches=bucket["searches"],
                point_views=bucket["point_views"],
                status_checks=bucket["status_checks"],
                status_cache_hits=bucket["status_cache_hits"],
                status_provider_calls=bucket["status_provider_calls"],
                successful_reservations=bucket["successful_reservations"],
                failed_reservations=bucket["failed_reservations"],
                conversion_numerator=bucket["successful_reservations"],
                conversion_denominator=bucket["point_views"],
                observed_amount=bucket["observed_amount"],
                currency=bucket["currency"],
                last_computed_at=refreshed_at,
            ),
        )

    for bucket in point_daily.values():
        db.add(PointDailyMetric(**bucket, last_computed_at=refreshed_at))

    for (provider_code, day_bucket, status_value), count in point_view_status_daily.items():
        db.add(
            ProviderStatusDailyMetric(
                provider_code=provider_code,
                day_bucket=day_bucket,
                status=status_value,
                count=count,
                last_computed_at=refreshed_at,
            ),
        )

    for day_bucket, bucket in operator_daily.items():
        db.add(
            OperatorDailyMetric(
                day_bucket=day_bucket,
                total_searches=bucket["total_searches"],
                total_point_views=bucket["total_point_views"],
                total_status_checks=bucket["total_status_checks"],
                successful_reservations=bucket["successful_reservations"],
                failed_reservations=bucket["failed_reservations"],
                conversion_numerator=bucket["successful_reservations"],
                conversion_denominator=bucket["total_point_views"],
                last_computed_at=refreshed_at,
            ),
        )

    for bucket in ev_reservation_daily.values():
        db.add(
            EvReservationDailyMetric(
                user_id=bucket["user_id"],
                day_bucket=bucket["day_bucket"],
                total_reservations=bucket["total_reservations"],
                successful_reservations=bucket["successful_reservations"],
                failed_reservations=bucket["failed_reservations"],
                total_duration_minutes=bucket["total_duration_minutes"],
                estimated_reservations=bucket["estimated_reservations"],
                missing_estimate_count=bucket["missing_estimate_count"],
                total_estimated_energy_kwh=round(bucket["total_estimated_energy_kwh"], 4),
                total_estimated_cost_eur=round(bucket["total_estimated_cost_eur"], 2),
                currency=bucket["currency"],
                point_keys=sorted(bucket["point_keys"]),
                estimated_point_keys=sorted(bucket["estimated_point_keys"]),
                last_computed_at=refreshed_at,
            ),
        )

    db.commit()
    return AggregateRefreshResult(
        usage_event_count=len(events),
        provider_hourly_rows=len(provider_hourly),
        provider_daily_rows=len(provider_daily),
        point_daily_rows=len(point_daily),
        provider_status_daily_rows=len(point_view_status_daily),
        operator_daily_rows=len(operator_daily),
        ev_reservation_daily_rows=len(ev_reservation_daily),
        refreshed_at=refreshed_at,
    )


def clear_aggregate_tables(db: Session) -> None:
    for model in (
        ProviderHourlyMetric,
        ProviderDailyMetric,
        PointDailyMetric,
        ProviderStatusDailyMetric,
        OperatorDailyMetric,
        EvReservationDailyMetric,
    ):
        db.query(model).delete()
    db.flush()


def hour_bucket(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=UTC)
    value = value.astimezone(UTC)
    return value.replace(minute=0, second=0, microsecond=0)


def empty_provider_bucket(provider_code: str, bucket) -> dict:
    return {
        "provider_code": provider_code,
        "bucket": bucket,
        "searches": 0,
        "point_views": 0,
        "status_checks": 0,
        "status_cache_hits": 0,
        "status_provider_calls": 0,
        "successful_reservations": 0,
        "failed_reservations": 0,
        "observed_amount": 0.0,
        "currency": None,
    }


def provider_codes_for_provider_aggregates(event: UsageEvent) -> list[str]:
    if event.event_type == EventType.USAGE_SEARCH_PERFORMED.value:
        if event.provider_code:
            return [event.provider_code]
        return normalized_provider_codes(event.payload.get("matched_provider_codes"))
    return [event.provider_code] if event.provider_code else []


def normalized_provider_codes(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    provider_codes: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        provider_code = item.strip()
        if not provider_code or provider_code in seen:
            continue
        seen.add(provider_code)
        provider_codes.append(provider_code)
    return provider_codes


def empty_operator_bucket() -> dict:
    return {
        "total_searches": 0,
        "total_point_views": 0,
        "total_status_checks": 0,
        "successful_reservations": 0,
        "failed_reservations": 0,
    }


def empty_ev_reservation_bucket(user_id: str, day_bucket) -> dict:
    return {
        "user_id": user_id,
        "day_bucket": day_bucket,
        "total_reservations": 0,
        "successful_reservations": 0,
        "failed_reservations": 0,
        "total_duration_minutes": 0,
        "estimated_reservations": 0,
        "missing_estimate_count": 0,
        "total_estimated_energy_kwh": 0.0,
        "total_estimated_cost_eur": 0.0,
        "currency": None,
        "point_keys": set(),
        "estimated_point_keys": set(),
    }


def apply_provider_event(bucket: dict, event: UsageEvent) -> None:
    if event.event_type == EventType.USAGE_SEARCH_PERFORMED.value:
        bucket["searches"] += 1
    elif event.event_type == EventType.USAGE_POINT_VIEWED.value:
        bucket["point_views"] += 1
    elif event.event_type == EventType.STATUS_POINT_CHECKED.value:
        bucket["status_checks"] += 1
        if event.payload.get("cache_hit") is True:
            bucket["status_cache_hits"] += 1
        if event.payload.get("provider_called") is True:
            bucket["status_provider_calls"] += 1
    elif event.event_type == EventType.RESERVATION_SUCCEEDED.value:
        bucket["successful_reservations"] += 1
        estimate = estimated_cost_components(event.payload)
        if estimate["estimated_cost_eur"] is not None:
            bucket["observed_amount"] += estimate["estimated_cost_eur"]
            bucket["currency"] = estimate["currency"] or bucket["currency"] or "EUR"
    elif event.event_type == EventType.RESERVATION_FAILED.value:
        bucket["failed_reservations"] += 1


def apply_operator_event(bucket: dict, event: UsageEvent) -> None:
    if event.event_type == EventType.USAGE_SEARCH_PERFORMED.value:
        bucket["total_searches"] += 1
    elif event.event_type == EventType.USAGE_POINT_VIEWED.value:
        bucket["total_point_views"] += 1
    elif event.event_type == EventType.STATUS_POINT_CHECKED.value:
        bucket["total_status_checks"] += 1
    elif event.event_type == EventType.RESERVATION_SUCCEEDED.value:
        bucket["successful_reservations"] += 1
    elif event.event_type == EventType.RESERVATION_FAILED.value:
        bucket["failed_reservations"] += 1


def apply_point_event(bucket: dict, event: UsageEvent) -> None:
    if event.event_type == EventType.USAGE_POINT_VIEWED.value:
        bucket["point_views"] += 1
    elif event.event_type == EventType.STATUS_POINT_CHECKED.value:
        bucket["status_checks"] += 1
    elif event.event_type == EventType.RESERVATION_SUCCEEDED.value:
        bucket["successful_reservations"] += 1
    elif event.event_type == EventType.RESERVATION_FAILED.value:
        bucket["failed_reservations"] += 1


def point_view_status_from_event(event: UsageEvent) -> str | None:
    if event.event_type != EventType.USAGE_POINT_VIEWED.value:
        return None
    return normalized_status(event.status) or "unknown"


def normalized_status(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower()
    return normalized if normalized in {"available", "charging", "reserved", "malfunction", "offline", "unknown"} else "unknown"


def apply_ev_reservation_event(bucket: dict, event: UsageEvent) -> None:
    bucket["total_reservations"] += 1
    point_key = ev_point_key(event)
    if point_key:
        bucket["point_keys"].add(point_key)

    if event.event_type == EventType.RESERVATION_SUCCEEDED.value:
        bucket["successful_reservations"] += 1
        duration_minutes = positive_int_value(event.payload, "requested_duration_minutes", "duration_minutes", "durationMinutes")
        if duration_minutes is not None:
            bucket["total_duration_minutes"] += duration_minutes
        estimate = estimated_cost_components(event.payload)
        if estimate["estimated_cost_eur"] is None:
            bucket["missing_estimate_count"] += 1
            return
        bucket["estimated_reservations"] += 1
        bucket["total_estimated_energy_kwh"] += estimate["estimated_energy_kwh"] or 0.0
        bucket["total_estimated_cost_eur"] += estimate["estimated_cost_eur"]
        bucket["currency"] = estimate["currency"] or bucket["currency"] or "EUR"
        if point_key:
            bucket["estimated_point_keys"].add(point_key)
    elif event.event_type == EventType.RESERVATION_FAILED.value:
        bucket["failed_reservations"] += 1


def ev_point_key(event: UsageEvent) -> str | None:
    if event.internal_point_id:
        return event.internal_point_id
    if event.provider_code and event.external_point_id:
        return f"{event.provider_code}:{event.external_point_id}"
    return event.external_point_id


def estimated_cost_components(payload: dict[str, Any]) -> dict[str, float | str | None]:
    explicit_cost = non_negative_float_value(payload, "estimated_cost_eur", "estimatedCostEur", "estimated_cost")
    explicit_energy = non_negative_float_value(payload, "estimated_energy_kwh", "estimatedEnergyKwh")
    currency = string_value(payload, "estimated_cost_currency", "currency") or "EUR"
    if explicit_cost is not None:
        return {
            "estimated_energy_kwh": explicit_energy,
            "estimated_cost_eur": explicit_cost,
            "currency": currency,
        }

    price_per_kwh = non_negative_float_value(payload, "price_per_kwh_eur", "cost_per_kwh_eur", "costPerKwhEur")
    capacity_kw = positive_float_value(payload, "charger_capacity_kw", "capacity_kw", "capacity")
    duration_minutes = positive_int_value(payload, "requested_duration_minutes", "duration_minutes", "durationMinutes")
    if price_per_kwh is None or capacity_kw is None or duration_minutes is None:
        return {"estimated_energy_kwh": explicit_energy, "estimated_cost_eur": None, "currency": None}

    estimated_energy_kwh = round(capacity_kw * duration_minutes / 60, 4)
    return {
        "estimated_energy_kwh": estimated_energy_kwh,
        "estimated_cost_eur": round(price_per_kwh * estimated_energy_kwh, 2),
        "currency": currency,
    }


def string_value(payload: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def positive_int_value(payload: dict[str, Any], *keys: str) -> int | None:
    for key in keys:
        value = payload.get(key)
        try:
            number = int(value)
        except (TypeError, ValueError):
            continue
        if number > 0:
            return number
    return None


def positive_float_value(payload: dict[str, Any], *keys: str) -> float | None:
    value = numeric_value(payload, *keys)
    if value is None or value <= 0:
        return None
    return value


def non_negative_float_value(payload: dict[str, Any], *keys: str) -> float | None:
    value = numeric_value(payload, *keys)
    if value is None or value < 0:
        return None
    return value


def numeric_value(payload: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = payload.get(key)
        if value is None or isinstance(value, bool):
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(number):
            return number
    return None
