from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.executor import JobNotFoundError, get_job_or_raise, run_job
from app.jobs import ORDERED_MAINTENANCE_JOB_KEYS, calculate_next_run
from app.models import JobRun, ScheduledJob
from app.schemas import (
    CurrentPrincipal,
    JobPatchRequest,
    JobRunResponse,
    JobSequenceRunResponse,
    MaintenanceSequenceRequest,
    ManualRunRequest,
    ScheduledJobResponse,
    SchedulerHealthResponse,
)
from app.security import ensure_operator, get_current_principal

router = APIRouter(tags=["scheduler"])


@router.get("/jobs", response_model=list[ScheduledJobResponse])
def list_jobs(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[ScheduledJobResponse]:
    ensure_operator(principal)
    jobs = db.scalars(select(ScheduledJob).order_by(ScheduledJob.job_key.asc())).all()
    return [job_response(job) for job in jobs]


@router.get("/jobs/{job_key}", response_model=ScheduledJobResponse)
def read_job(
    job_key: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ScheduledJobResponse:
    ensure_operator(principal)
    try:
        return job_response(get_job_or_raise(db, job_key))
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/jobs/{job_key}", response_model=ScheduledJobResponse)
def patch_job(
    job_key: str,
    body: JobPatchRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ScheduledJobResponse:
    ensure_operator(principal)
    try:
        job = get_job_or_raise(db, job_key)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if body.enabled is not None:
        job.enabled = body.enabled
    if body.interval_seconds is not None:
        if job.schedule_type != "interval":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only interval jobs can change interval_seconds")
        job.interval_seconds = body.interval_seconds
    if body.cron_expression is not None:
        if job.schedule_type != "cron":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only cron jobs can change cron_expression")
        job.cron_expression = body.cron_expression
    if body.timeout_seconds is not None:
        job.timeout_seconds = body.timeout_seconds
    if body.max_retries is not None:
        job.max_retries = body.max_retries
    job.next_run_at = calculate_next_run(job)
    db.commit()
    db.refresh(job)
    return job_response(job)


@router.post("/jobs/{job_key}/run", response_model=JobRunResponse)
def run_job_endpoint(
    job_key: str,
    body: ManualRunRequest | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> JobRunResponse:
    ensure_operator(principal)
    try:
        job = get_job_or_raise(db, job_key)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    run = run_job(
        db,
        settings,
        job,
        "manual",
        triggered_by_email=principal.email,
        request_body_override=body.request_body if body else None,
    )
    return run_response(run)


@router.post("/jobs/run-maintenance", response_model=JobSequenceRunResponse)
def run_maintenance_jobs(
    body: MaintenanceSequenceRequest | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> JobSequenceRunResponse:
    ensure_operator(principal)
    runs: list[JobRun] = []
    for job_key in ORDERED_MAINTENANCE_JOB_KEYS:
        try:
            job = get_job_or_raise(db, job_key)
        except JobNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        runs.append(
            run_job(
                db,
                settings,
                job,
                "manual_sequence",
                triggered_by_email=principal.email,
                request_body_override=(
                    {"provider_code": body.provider_code}
                    if job_key == "catalog.import.all" and body and body.provider_code
                    else None
                ),
            ),
        )

    sequence_status = "succeeded" if all(run.status == "succeeded" for run in runs) else "completed_with_failures"
    return JobSequenceRunResponse(
        sequence_key="maintenance.ordered",
        status=sequence_status,
        ordered_job_keys=list(ORDERED_MAINTENANCE_JOB_KEYS),
        runs=[run_response(run) for run in runs],
    )


@router.post("/jobs/{job_key}/pause", response_model=ScheduledJobResponse)
def pause_job(
    job_key: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ScheduledJobResponse:
    ensure_operator(principal)
    try:
        job = get_job_or_raise(db, job_key)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    job.enabled = False
    job.next_run_at = None
    db.commit()
    db.refresh(job)
    return job_response(job)


@router.post("/jobs/{job_key}/resume", response_model=ScheduledJobResponse)
def resume_job(
    job_key: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ScheduledJobResponse:
    ensure_operator(principal)
    try:
        job = get_job_or_raise(db, job_key)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    job.enabled = True
    job.next_run_at = calculate_next_run(job)
    db.commit()
    db.refresh(job)
    return job_response(job)


@router.get("/runs", response_model=list[JobRunResponse])
def list_runs(
    job_key: str | None = Query(default=None, alias="jobKey"),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[JobRunResponse]:
    ensure_operator(principal)
    query = select(JobRun)
    if job_key:
        query = query.where(JobRun.job_key == job_key)
    if status_filter:
        query = query.where(JobRun.status == status_filter)
    runs = db.scalars(query.order_by(JobRun.queued_at.desc()).limit(limit)).all()
    return [run_response(run) for run in runs]


@router.get("/runs/{run_id}", response_model=JobRunResponse)
def read_run(
    run_id: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> JobRunResponse:
    ensure_operator(principal)
    run = db.get(JobRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job run not found")
    return run_response(run)


@router.get("/health", response_model=SchedulerHealthResponse)
def health(db: Session = Depends(get_db)) -> SchedulerHealthResponse:
    total_jobs = db.scalar(select(func.count()).select_from(ScheduledJob)) or 0
    enabled_jobs = db.scalar(select(func.count()).select_from(ScheduledJob).where(ScheduledJob.enabled.is_(True))) or 0
    running_jobs = db.scalar(select(func.count()).select_from(JobRun).where(JobRun.status == "running")) or 0
    last_run = db.scalar(select(JobRun).order_by(JobRun.queued_at.desc()).limit(1))
    return SchedulerHealthResponse(
        service="scheduler-service",
        status="healthy",
        total_job_count=total_jobs,
        enabled_job_count=enabled_jobs,
        running_job_count=running_jobs,
        last_run_status=last_run.status if last_run else None,
    )


def job_response(job: ScheduledJob) -> ScheduledJobResponse:
    return ScheduledJobResponse(
        id=job.id,
        job_key=job.job_key,
        description=job.description,
        target_service=job.target_service,
        target_url_path=job.target_url_path,
        http_method=job.http_method,
        schedule_type=job.schedule_type,
        interval_seconds=job.interval_seconds,
        cron_expression=job.cron_expression,
        timezone=job.timezone,
        enabled=job.enabled,
        next_run_at=job.next_run_at.isoformat() if job.next_run_at else None,
        timeout_seconds=job.timeout_seconds,
        max_retries=job.max_retries,
        retry_backoff_seconds=job.retry_backoff_seconds,
        request_body=job.request_body,
        last_run_id=job.last_run_id,
        last_run_status=job.last_run_status,
        last_started_at=job.last_started_at.isoformat() if job.last_started_at else None,
        last_finished_at=job.last_finished_at.isoformat() if job.last_finished_at else None,
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
    )


def run_response(run: JobRun) -> JobRunResponse:
    return JobRunResponse(
        id=run.id,
        job_id=run.job_id,
        job_key=run.job_key,
        status=run.status,
        trigger_type=run.trigger_type,
        triggered_by_email=run.triggered_by_email,
        scheduler_instance_id=run.scheduler_instance_id,
        queued_at=run.queued_at.isoformat(),
        started_at=run.started_at.isoformat() if run.started_at else None,
        finished_at=run.finished_at.isoformat() if run.finished_at else None,
        duration_ms=run.duration_ms,
        target_service=run.target_service,
        target_url_path=run.target_url_path,
        http_method=run.http_method,
        target_http_status=run.target_http_status,
        attempt_number=run.attempt_number,
        max_attempts=run.max_attempts,
        response_summary=run.response_summary,
        error_type=run.error_type,
        error_message=run.error_message,
        correlation_id=run.correlation_id,
    )
