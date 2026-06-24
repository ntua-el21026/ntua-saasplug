from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


MINIMUM_INTERVAL_SECONDS = 30


class CurrentPrincipal(BaseModel):
    sub: str
    email: str
    roles: list[str]
    provider_id: str | None = None
    provider_code: str | None = None


class ScheduledJobResponse(BaseModel):
    id: str
    job_key: str
    description: str
    target_service: str
    target_url_path: str
    http_method: str
    schedule_type: str
    interval_seconds: int | None
    cron_expression: str | None
    timezone: str
    enabled: bool
    next_run_at: str | None
    timeout_seconds: int
    max_retries: int
    retry_backoff_seconds: int
    request_body: dict[str, Any] | None
    last_run_id: str | None
    last_run_status: str | None
    last_started_at: str | None
    last_finished_at: str | None
    created_at: str
    updated_at: str


class SchedulerIntervalPresetResponse(BaseModel):
    preset: Literal["minimum", "defaults"]
    updated_count: int
    jobs: list[ScheduledJobResponse]


class JobRunResponse(BaseModel):
    id: str
    job_id: str
    job_key: str
    status: str
    trigger_type: str
    triggered_by_email: str | None
    scheduler_instance_id: str
    queued_at: str
    started_at: str | None
    finished_at: str | None
    duration_ms: int | None
    target_service: str
    target_url_path: str
    http_method: str
    target_http_status: int | None
    attempt_number: int
    max_attempts: int
    response_summary: dict[str, Any] | None
    error_type: str | None
    error_message: str | None
    correlation_id: str


class JobSequenceRunResponse(BaseModel):
    sequence_key: str
    status: Literal["succeeded", "completed_with_failures"]
    ordered_job_keys: list[str]
    runs: list[JobRunResponse]


class MaintenanceSequenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_code: str | None = None


class JobPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool | None = None
    interval_seconds: int | None = Field(default=None, ge=MINIMUM_INTERVAL_SECONDS)
    cron_expression: str | None = None
    timeout_seconds: int | None = Field(default=None, ge=1, le=600)
    max_retries: int | None = Field(default=None, ge=0, le=5)


class ManualRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_body: dict[str, Any] | None = None


class SchedulerHealthResponse(BaseModel):
    service: str
    status: Literal["healthy"]
    enabled_job_count: int
    total_job_count: int
    running_job_count: int
    last_run_status: str | None
