from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
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
    refreshed_at: datetime


def refresh_aggregates(db: Session) -> AggregateRefreshResult:
    refreshed_at = utcnow()
    clear_aggregate_tables(db)
    events = db.scalars(select(UsageEvent).order_by(UsageEvent.occurred_at.asc())).all()

    provider_hourly: dict[tuple[str, datetime], dict] = {}
    provider_daily: dict[tuple[str, object], dict] = {}
    point_daily: dict[tuple[str, object, str | None, str | None], dict] = {}
    provider_status_daily: dict[tuple[str, object, str], int] = {}
    operator_daily: dict[object, dict] = {}

    for event in events:
        event_day = event.occurred_at.date()
        event_hour = hour_bucket(event.occurred_at)

        operator_bucket = operator_daily.setdefault(event_day, empty_operator_bucket())
        apply_operator_event(operator_bucket, event)

        if event.provider_code:
            provider_hour_bucket = provider_hourly.setdefault(
                (event.provider_code, event_hour),
                empty_provider_bucket(event.provider_code, event_hour),
            )
            provider_day_bucket = provider_daily.setdefault(
                (event.provider_code, event_day),
                empty_provider_bucket(event.provider_code, event_day),
            )
            apply_provider_event(provider_hour_bucket, event)
            apply_provider_event(provider_day_bucket, event)

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

            if event.event_type == EventType.STATUS_POINT_CHECKED.value:
                status_value = event.status or "unknown"
                status_key = (event.provider_code, event_day, status_value)
                provider_status_daily[status_key] = provider_status_daily.get(status_key, 0) + 1

    for bucket in provider_hourly.values():
        db.add(
            ProviderHourlyMetric(
                provider_code=bucket["provider_code"],
                hour_bucket=bucket["bucket"],
                searches=bucket["searches"],
                point_views=bucket["point_views"],
                status_checks=bucket["status_checks"],
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

    for (provider_code, day_bucket, status_value), count in provider_status_daily.items():
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

    db.commit()
    return AggregateRefreshResult(
        usage_event_count=len(events),
        provider_hourly_rows=len(provider_hourly),
        provider_daily_rows=len(provider_daily),
        point_daily_rows=len(point_daily),
        provider_status_daily_rows=len(provider_status_daily),
        operator_daily_rows=len(operator_daily),
        refreshed_at=refreshed_at,
    )


def clear_aggregate_tables(db: Session) -> None:
    for model in (
        ProviderHourlyMetric,
        ProviderDailyMetric,
        PointDailyMetric,
        ProviderStatusDailyMetric,
        OperatorDailyMetric,
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
        "successful_reservations": 0,
        "failed_reservations": 0,
        "observed_amount": 0.0,
        "currency": None,
    }


def empty_operator_bucket() -> dict:
    return {
        "total_searches": 0,
        "total_point_views": 0,
        "total_status_checks": 0,
        "successful_reservations": 0,
        "failed_reservations": 0,
    }


def apply_provider_event(bucket: dict, event: UsageEvent) -> None:
    if event.event_type == EventType.USAGE_SEARCH_PERFORMED.value:
        bucket["searches"] += 1
    elif event.event_type == EventType.USAGE_POINT_VIEWED.value:
        bucket["point_views"] += 1
    elif event.event_type == EventType.STATUS_POINT_CHECKED.value:
        bucket["status_checks"] += 1
    elif event.event_type == EventType.RESERVATION_SUCCEEDED.value:
        bucket["successful_reservations"] += 1
    elif event.event_type == EventType.RESERVATION_FAILED.value:
        bucket["failed_reservations"] += 1
    if event.amount is not None and event.event_type.startswith("billing."):
        bucket["observed_amount"] += event.amount
        bucket["currency"] = event.currency or bucket["currency"]


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
