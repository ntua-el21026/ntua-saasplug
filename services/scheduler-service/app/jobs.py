from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ScheduledJob, utcnow


@dataclass(frozen=True)
class JobSeed:
    job_key: str
    description: str
    target_service: str
    target_url_path: str
    schedule_type: str
    interval_seconds: int | None
    cron_expression: str | None
    timezone: str
    timeout_seconds: int
    max_retries: int
    retry_backoff_seconds: int = 5


DEFAULT_JOBS: tuple[JobSeed, ...] = (
    JobSeed(
        "catalog.import.all",
        "Import all provider catalogs through catalog-service.",
        "catalog-service",
        "/internal/jobs/catalog/imports/all",
        "interval",
        15 * 60,
        None,
        "UTC",
        180,
        1,
    ),
    JobSeed(
        "analytics.consume-events",
        "Drain analytics RabbitMQ events into analytics-service-owned tables.",
        "analytics-service",
        "/internal/jobs/events/consume",
        "interval",
        60,
        None,
        "UTC",
        30,
        2,
    ),
    JobSeed(
        "analytics.refresh-aggregates",
        "Refresh analytics aggregate tables.",
        "analytics-service",
        "/internal/jobs/aggregates/refresh",
        "interval",
        5 * 60,
        None,
        "UTC",
        90,
        1,
    ),
    JobSeed(
        "billing.drain-events",
        "Drain billing RabbitMQ events into billing-service-owned tables.",
        "billing-service",
        "/internal/jobs/events/drain",
        "interval",
        60,
        None,
        "UTC",
        30,
        2,
    ),
    JobSeed(
        "billing.publish-outbox",
        "Publish pending billing outbox events.",
        "billing-service",
        "/internal/jobs/outbox/publish-pending",
        "interval",
        60,
        None,
        "UTC",
        30,
        2,
    ),
    JobSeed(
        "reservation.publish-outbox",
        "Publish pending reservation outbox events.",
        "reservation-service",
        "/internal/jobs/outbox/publish-pending",
        "interval",
        60,
        None,
        "UTC",
        30,
        2,
    ),
    JobSeed(
        "billing.prepare-invoices",
        "Prepare invoice candidate summaries without issuing invoices.",
        "billing-service",
        "/internal/jobs/invoices/prepare",
        "cron",
        None,
        "30 2 * * *",
        "Europe/Athens",
        180,
        1,
    ),
    JobSeed(
        "catalog.import.red",
        "Manually import redPlug catalog through catalog-service.",
        "catalog-service",
        "/internal/jobs/catalog/imports/providers/redPlug",
        "manual",
        None,
        None,
        "UTC",
        180,
        1,
    ),
    JobSeed(
        "catalog.import.green",
        "Manually import greenPlug catalog through catalog-service.",
        "catalog-service",
        "/internal/jobs/catalog/imports/providers/greenPlug",
        "manual",
        None,
        None,
        "UTC",
        180,
        1,
    ),
    JobSeed(
        "catalog.import.blue",
        "Manually import bluePlug catalog through catalog-service.",
        "catalog-service",
        "/internal/jobs/catalog/imports/providers/bluePlug",
        "manual",
        None,
        None,
        "UTC",
        180,
        1,
    ),
    JobSeed(
        "analytics.refresh-aggregates.manual",
        "Manually refresh analytics aggregate tables.",
        "analytics-service",
        "/internal/jobs/aggregates/refresh",
        "manual",
        None,
        None,
        "UTC",
        90,
        1,
    ),
    JobSeed(
        "billing.drain-events.manual",
        "Manually drain billing events.",
        "billing-service",
        "/internal/jobs/events/drain",
        "manual",
        None,
        None,
        "UTC",
        30,
        2,
    ),
)


def seed_default_jobs(db: Session) -> None:
    now = utcnow()
    for seed in DEFAULT_JOBS:
        job = db.scalar(select(ScheduledJob).where(ScheduledJob.job_key == seed.job_key))
        if job is None:
            job = ScheduledJob(
                job_key=seed.job_key,
                description=seed.description,
                target_service=seed.target_service,
                target_url_path=seed.target_url_path,
                http_method="POST",
                schedule_type=seed.schedule_type,
                interval_seconds=seed.interval_seconds,
                cron_expression=seed.cron_expression,
                timezone=seed.timezone,
                timeout_seconds=seed.timeout_seconds,
                max_retries=seed.max_retries,
                retry_backoff_seconds=seed.retry_backoff_seconds,
                request_body={},
                enabled=True,
            )
            job.next_run_at = calculate_next_run(job, now)
            db.add(job)
            continue

        job.description = seed.description
        job.target_service = seed.target_service
        job.target_url_path = seed.target_url_path
        job.http_method = "POST"
        job.schedule_type = seed.schedule_type
        job.interval_seconds = seed.interval_seconds
        job.cron_expression = seed.cron_expression
        job.timezone = seed.timezone
        job.timeout_seconds = seed.timeout_seconds
        job.max_retries = seed.max_retries
        job.retry_backoff_seconds = seed.retry_backoff_seconds
        if job.request_body is None:
            job.request_body = {}
        if job.enabled and job.next_run_at is None:
            job.next_run_at = calculate_next_run(job, now)
    db.commit()


def calculate_next_run(job: ScheduledJob, from_time: datetime | None = None) -> datetime | None:
    if job.schedule_type == "manual" or not job.enabled:
        return None

    now = ensure_aware_utc(from_time or utcnow())
    if job.schedule_type == "interval" and job.interval_seconds:
        return now + timedelta(seconds=job.interval_seconds)

    if job.schedule_type == "cron" and job.cron_expression:
        return next_daily_cron_run(job.cron_expression, job.timezone, now)

    return None


def next_daily_cron_run(expression: str, timezone_name: str, from_time: datetime) -> datetime:
    parts = expression.split()
    if len(parts) != 5:
        raise ValueError("Only five-field daily cron expressions are supported")
    minute = int(parts[0])
    hour = int(parts[1])
    tz = ZoneInfo(timezone_name)
    local_now = ensure_aware_utc(from_time).astimezone(tz)
    next_local = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if next_local <= local_now:
        next_local = next_local + timedelta(days=1)
    return next_local.astimezone(timezone.utc)


def ensure_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
