from datetime import datetime, timezone
from time import sleep
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.client import InternalJobClient
from app.config import Settings
from app.jobs import calculate_next_run, ensure_aware_utc
from app.models import JobRun, ScheduledJob, utcnow


class JobNotFoundError(ValueError):
    pass


def get_job_or_raise(db: Session, job_key: str) -> ScheduledJob:
    job = db.scalar(select(ScheduledJob).where(ScheduledJob.job_key == job_key))
    if job is None:
        raise JobNotFoundError(f"Scheduled job not found: {job_key}")
    return job


def run_job(
    db: Session,
    settings: Settings,
    job: ScheduledJob,
    trigger_type: str,
    triggered_by_email: str | None = None,
    request_body_override: dict[str, Any] | None = None,
    client: InternalJobClient | None = None,
) -> JobRun:
    if trigger_type == "scheduled" and not job.enabled:
        return create_skipped_run(db, settings, job, trigger_type, "Job is paused")

    running_count = db.scalar(select(func.count()).select_from(JobRun).where(JobRun.status == "running")) or 0
    if running_count >= settings.max_concurrent_jobs:
        return create_skipped_run(db, settings, job, trigger_type, "Scheduler concurrency limit reached")

    run = JobRun(
        job_id=job.id,
        job_key=job.job_key,
        status="running",
        trigger_type=trigger_type,
        triggered_by_email=triggered_by_email,
        scheduler_instance_id=settings.instance_id,
        queued_at=utcnow(),
        started_at=utcnow(),
        target_service=job.target_service,
        target_url_path=job.target_url_path,
        http_method=job.http_method,
        max_attempts=max(1, job.max_retries + 1),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    owns_client = client is None
    active_client = client or InternalJobClient(settings)
    request_body = request_body_override if request_body_override is not None else job.request_body
    final_status = "failed"
    response_summary: dict[str, Any] | None = None
    target_http_status: int | None = None
    error_type: str | None = None
    error_message: str | None = None

    try:
        for attempt in range(1, run.max_attempts + 1):
            run.attempt_number = attempt
            db.commit()
            try:
                target_http_status, response_summary = active_client.call(job, run, request_body)
                if 200 <= target_http_status < 300:
                    final_status = "succeeded"
                    error_type = None
                    error_message = None
                    break
                error_type = "target_http_error"
                error_message = f"Target returned HTTP {target_http_status}"
            except Exception as exc:  # pragma: no cover - exercised through API behavior tests
                error_type = exc.__class__.__name__
                error_message = str(exc)
                response_summary = None
            if attempt < run.max_attempts:
                sleep(min(job.retry_backoff_seconds, 1))
    finally:
        if owns_client:
            active_client.close()

    finished_at = utcnow()
    run.status = final_status
    run.finished_at = finished_at
    run.duration_ms = duration_ms(run.started_at, finished_at)
    run.target_http_status = target_http_status
    run.response_summary = response_summary
    run.error_type = error_type
    run.error_message = error_message

    job.last_run_id = run.id
    job.last_run_status = run.status
    job.last_started_at = run.started_at
    job.last_finished_at = run.finished_at
    job.next_run_at = calculate_next_run(job, finished_at)
    db.commit()
    db.refresh(run)
    return run


def create_skipped_run(
    db: Session,
    settings: Settings,
    job: ScheduledJob,
    trigger_type: str,
    message: str,
) -> JobRun:
    now = utcnow()
    run = JobRun(
        job_id=job.id,
        job_key=job.job_key,
        status="skipped",
        trigger_type=trigger_type,
        scheduler_instance_id=settings.instance_id,
        queued_at=now,
        started_at=now,
        finished_at=now,
        duration_ms=0,
        target_service=job.target_service,
        target_url_path=job.target_url_path,
        http_method=job.http_method,
        attempt_number=0,
        max_attempts=max(1, job.max_retries + 1),
        error_type="skipped",
        error_message=message,
    )
    db.add(run)
    job.last_run_id = run.id
    job.last_run_status = run.status
    job.last_started_at = run.started_at
    job.last_finished_at = run.finished_at
    job.next_run_at = calculate_next_run(job, now)
    db.commit()
    db.refresh(run)
    return run


def select_due_jobs(db: Session, now: datetime | None = None, limit: int = 10) -> list[ScheduledJob]:
    due_at = ensure_aware_utc(now or utcnow())
    running_subquery = select(JobRun.job_key).where(JobRun.status == "running")
    return db.scalars(
        select(ScheduledJob)
        .where(
            ScheduledJob.enabled.is_(True),
            ScheduledJob.schedule_type.in_(("interval", "cron")),
            ScheduledJob.next_run_at.is_not(None),
            ScheduledJob.next_run_at <= due_at,
            ScheduledJob.job_key.not_in(running_subquery),
        )
        .order_by(ScheduledJob.next_run_at.asc())
        .limit(limit),
    ).all()


def run_due_jobs(db: Session, settings: Settings) -> list[JobRun]:
    runs: list[JobRun] = []
    for job in select_due_jobs(db, limit=settings.max_concurrent_jobs):
        runs.append(run_job(db, settings, job, "scheduled"))
    return runs


def duration_ms(started_at: datetime | None, finished_at: datetime) -> int | None:
    if started_at is None:
        return None
    started = ensure_aware_utc(started_at)
    finished = ensure_aware_utc(finished_at)
    return max(0, int((finished - started).total_seconds() * 1000))
