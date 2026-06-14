import csv
import io
import json
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.aggregates import refresh_aggregates
from app.config import Settings, get_settings
from app.database import get_db
from app.ingestion import IngestResult, ingest_events
from app.models import (
    BillingSummarySnapshot,
    CatalogHealthSnapshot,
    ExportJob,
    OperatorDailyMetric,
    PointDailyMetric,
    ProviderDailyMetric,
    ProviderStatusDailyMetric,
    UsageEvent,
)
from app.rabbitmq_consumer import consume_analytics_events
from app.schemas import (
    AggregateRefreshResponse,
    ConsumeResponse,
    CurrentPrincipal,
    FreshnessResponse,
    IngestResponse,
    IngestResultResponse,
    OperatorSummaryResponse,
    PointMetricResponse,
    ProviderDailyTrendResponse,
    ProviderSummaryResponse,
    StatusDistributionResponse,
)
from app.security import (
    ensure_operator,
    ensure_provider_admin_or_operator,
    get_current_principal,
    principal_primary_role,
    resolve_provider_scope,
)
from saasplug_events.envelope import EventEnvelope

router = APIRouter(tags=["analytics"])


def require_scheduler_token(
    x_scheduler_token: str | None = Header(default=None, alias="X-Scheduler-Token"),
    settings: Settings = Depends(get_settings),
) -> None:
    if not x_scheduler_token or x_scheduler_token != settings.scheduler_internal_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid scheduler token")


def require_scheduler_job(
    x_job_run_id: str | None = Header(default=None, alias="X-Job-Run-Id"),
    _: None = Depends(require_scheduler_token),
) -> str:
    if not x_job_run_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing scheduler job run id")
    return x_job_run_id


@router.post("/events/ingest", response_model=IngestResponse)
def ingest_events_endpoint(
    body: Annotated[EventEnvelope | list[EventEnvelope], Body()],
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> IngestResponse:
    ensure_operator(principal)
    envelopes = body if isinstance(body, list) else [body]
    return ingest_response(ingest_events(db, envelopes))


@router.post("/events/consume", response_model=ConsumeResponse)
def consume_events_endpoint(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ConsumeResponse:
    ensure_operator(principal)
    result = consume_analytics_events(settings, db, limit)
    return ConsumeResponse(**result.__dict__)


@router.post("/aggregates/refresh", response_model=AggregateRefreshResponse)
def refresh_aggregates_endpoint(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> AggregateRefreshResponse:
    ensure_operator(principal)
    result = refresh_aggregates(db)
    return AggregateRefreshResponse(
        usage_event_count=result.usage_event_count,
        provider_hourly_rows=result.provider_hourly_rows,
        provider_daily_rows=result.provider_daily_rows,
        point_daily_rows=result.point_daily_rows,
        provider_status_daily_rows=result.provider_status_daily_rows,
        operator_daily_rows=result.operator_daily_rows,
        refreshed_at=result.refreshed_at.isoformat(),
    )


@router.post("/internal/jobs/events/consume", response_model=ConsumeResponse)
def consume_events_from_scheduler(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: str = Depends(require_scheduler_job),
) -> ConsumeResponse:
    effective_limit = min(limit, settings.rabbitmq_consume_batch_size)
    result = consume_analytics_events(settings, db, effective_limit)
    return ConsumeResponse(**result.__dict__)


@router.post("/internal/jobs/aggregates/refresh", response_model=AggregateRefreshResponse)
def refresh_aggregates_from_scheduler(
    db: Session = Depends(get_db),
    _: str = Depends(require_scheduler_job),
) -> AggregateRefreshResponse:
    result = refresh_aggregates(db)
    return AggregateRefreshResponse(
        usage_event_count=result.usage_event_count,
        provider_hourly_rows=result.provider_hourly_rows,
        provider_daily_rows=result.provider_daily_rows,
        point_daily_rows=result.point_daily_rows,
        provider_status_daily_rows=result.provider_status_daily_rows,
        operator_daily_rows=result.operator_daily_rows,
        refreshed_at=result.refreshed_at.isoformat(),
    )


@router.get("/internal/jobs/freshness", response_model=FreshnessResponse)
def read_internal_freshness(
    db: Session = Depends(get_db),
    _: str = Depends(require_scheduler_job),
) -> FreshnessResponse:
    return freshness_response(db, None)


@router.get("/provider/summary", response_model=ProviderSummaryResponse)
def provider_summary(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ProviderSummaryResponse:
    ensure_provider_admin_or_operator(principal)
    resolved_provider_code = resolve_provider_scope(principal, provider_code)
    metrics = provider_daily_metrics(db, resolved_provider_code)
    status_distribution = provider_status_distribution(db, resolved_provider_code)
    top_viewed = top_points(db, resolved_provider_code, metric="views")
    top_reserved = top_points(db, resolved_provider_code, metric="reservations")
    totals = provider_totals(metrics)
    freshness = freshness_response(db, resolved_provider_code)
    return ProviderSummaryResponse(
        provider_code=resolved_provider_code or "all",
        total_searches=totals["searches"],
        total_point_views=totals["point_views"],
        total_status_checks=totals["status_checks"],
        successful_reservations=totals["successful_reservations"],
        failed_reservations=totals["failed_reservations"],
        reservation_conversion_rate=conversion_rate(
            totals["successful_reservations"],
            totals["point_views"],
        ),
        observed_amount=totals["observed_amount"],
        currency=totals["currency"],
        top_viewed_points=top_viewed,
        top_reserved_points=top_reserved,
        status_distribution=status_distribution,
        data_freshness=freshness,
        last_event_ingested_at=freshness.last_event_ingested_at,
        last_aggregate_computed_at=freshness.last_aggregate_computed_at,
    )


@router.get("/provider/trends/daily", response_model=list[ProviderDailyTrendResponse])
def provider_daily_trends(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[ProviderDailyTrendResponse]:
    ensure_provider_admin_or_operator(principal)
    resolved_provider_code = resolve_provider_scope(principal, provider_code)
    metrics = provider_daily_metrics(db, resolved_provider_code)
    return [
        ProviderDailyTrendResponse(
            provider_code=metric.provider_code,
            day_bucket=metric.day_bucket.isoformat(),
            searches=metric.searches,
            point_views=metric.point_views,
            status_checks=metric.status_checks,
            successful_reservations=metric.successful_reservations,
            failed_reservations=metric.failed_reservations,
            reservation_conversion_rate=conversion_rate(
                metric.successful_reservations,
                metric.point_views,
            ),
            observed_amount=metric.observed_amount,
            currency=metric.currency,
        )
        for metric in metrics
    ]


@router.get("/provider/top-points", response_model=list[PointMetricResponse])
def provider_top_points(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    metric: str = Query(default="views", pattern="^(views|reservations)$"),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[PointMetricResponse]:
    ensure_provider_admin_or_operator(principal)
    resolved_provider_code = resolve_provider_scope(principal, provider_code)
    return top_points(db, resolved_provider_code, metric=metric, limit=limit)


@router.get("/provider/status-distribution", response_model=StatusDistributionResponse)
def provider_status_distribution_endpoint(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> StatusDistributionResponse:
    ensure_provider_admin_or_operator(principal)
    resolved_provider_code = resolve_provider_scope(principal, provider_code)
    return StatusDistributionResponse(
        provider_code=resolved_provider_code or "all",
        status_distribution=provider_status_distribution(db, resolved_provider_code),
    )


@router.get("/provider/freshness", response_model=FreshnessResponse)
def provider_freshness(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> FreshnessResponse:
    ensure_provider_admin_or_operator(principal)
    resolved_provider_code = resolve_provider_scope(principal, provider_code)
    return freshness_response(db, resolved_provider_code)


@router.get("/operator/summary", response_model=OperatorSummaryResponse)
def operator_summary(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> OperatorSummaryResponse:
    ensure_operator(principal)
    daily_metrics = db.scalars(select(OperatorDailyMetric).order_by(OperatorDailyMetric.day_bucket.asc())).all()
    total_searches = sum(metric.total_searches for metric in daily_metrics)
    total_point_views = sum(metric.total_point_views for metric in daily_metrics)
    total_status_checks = sum(metric.total_status_checks for metric in daily_metrics)
    successful_reservations = sum(metric.successful_reservations for metric in daily_metrics)
    failed_reservations = sum(metric.failed_reservations for metric in daily_metrics)
    providers_seen = provider_comparison_rows(db)
    freshness = freshness_response(db, None)
    return OperatorSummaryResponse(
        total_providers_seen=len(providers_seen),
        active_providers_seen=sum(1 for row in providers_seen if row["total_point_views"] > 0 or row["successful_reservations"] > 0),
        total_searches=total_searches,
        total_point_views=total_point_views,
        total_status_checks=total_status_checks,
        successful_reservations=successful_reservations,
        failed_reservations=failed_reservations,
        global_conversion_rate=conversion_rate(successful_reservations, total_point_views),
        provider_comparison=providers_seen,
        daily_trends=operator_daily_rows(daily_metrics),
        catalog_health=catalog_health_rows(db),
        last_event_ingested_at=freshness.last_event_ingested_at,
        last_aggregate_computed_at=freshness.last_aggregate_computed_at,
        analytics_delay_notice=freshness.analytics_delay_notice,
    )


@router.get("/operator/provider-comparison")
def operator_provider_comparison(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[dict]:
    ensure_operator(principal)
    return provider_comparison_rows(db)


@router.get("/operator/trends/daily")
def operator_trends_daily(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[dict]:
    ensure_operator(principal)
    daily_metrics = db.scalars(select(OperatorDailyMetric).order_by(OperatorDailyMetric.day_bucket.asc())).all()
    return operator_daily_rows(daily_metrics)


@router.get("/operator/catalog-health")
def operator_catalog_health(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[dict]:
    ensure_operator(principal)
    return catalog_health_rows(db)


@router.get("/operator/freshness", response_model=FreshnessResponse)
def operator_freshness(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> FreshnessResponse:
    ensure_operator(principal)
    return freshness_response(db, None)


@router.get("/exports/usage.csv")
def export_usage_csv(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> Response:
    ensure_provider_admin_or_operator(principal)
    resolved_provider_code = resolve_provider_scope(principal, provider_code)
    rows = usage_events_for_export(db, resolved_provider_code, from_date, to_date)
    job = ExportJob(
        actor_email=principal.email,
        actor_role=principal_primary_role(principal),
        actor_provider_code=principal.provider_code,
        provider_code=resolved_provider_code,
        from_date=from_date,
        to_date=to_date,
        row_count=len(rows),
    )
    db.add(job)
    db.commit()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "occurred_at",
            "event_type",
            "provider_code",
            "internal_point_id",
            "external_point_id",
            "point_name",
            "user_id",
            "reservation_id",
            "status",
            "amount",
            "currency",
            "details",
        ],
    )
    for row in rows:
        writer.writerow(
            [
                row.occurred_at.isoformat(),
                row.event_type,
                row.provider_code or "",
                row.internal_point_id or "",
                row.external_point_id or "",
                row.point_name or "",
                row.user_id or "",
                row.reservation_id or "",
                row.status or "",
                "" if row.amount is None else row.amount,
                row.currency or "",
                json.dumps(row.payload, sort_keys=True, separators=(",", ":")),
            ],
        )
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="saasplug-usage-{job.id}.csv"'},
    )


def ingest_response(results: list[IngestResult]) -> IngestResponse:
    return IngestResponse(
        created_count=sum(1 for result in results if result.status == "created"),
        duplicate_count=sum(1 for result in results if result.status == "duplicate"),
        unsupported_count=sum(1 for result in results if result.status == "unsupported"),
        results=[
            IngestResultResponse(
                event_id=result.event_id,
                event_type=result.event_type,
                result=result.status,
                message=result.message,
            )
            for result in results
        ],
    )


def provider_daily_metrics(db: Session, provider_code: str | None) -> list[ProviderDailyMetric]:
    query = select(ProviderDailyMetric)
    if provider_code:
        query = query.where(ProviderDailyMetric.provider_code == provider_code)
    return db.scalars(query.order_by(ProviderDailyMetric.day_bucket.asc())).all()


def provider_totals(metrics: list[ProviderDailyMetric]) -> dict:
    currency = next((metric.currency for metric in metrics if metric.currency), None)
    return {
        "searches": sum(metric.searches for metric in metrics),
        "point_views": sum(metric.point_views for metric in metrics),
        "status_checks": sum(metric.status_checks for metric in metrics),
        "successful_reservations": sum(metric.successful_reservations for metric in metrics),
        "failed_reservations": sum(metric.failed_reservations for metric in metrics),
        "observed_amount": sum(metric.observed_amount for metric in metrics),
        "currency": currency,
    }


def top_points(
    db: Session,
    provider_code: str | None,
    metric: str,
    limit: int = 10,
) -> list[PointMetricResponse]:
    query = select(PointDailyMetric)
    if provider_code:
        query = query.where(PointDailyMetric.provider_code == provider_code)
    rows = db.scalars(query).all()
    grouped: dict[tuple[str, str | None, str | None], dict] = {}
    for row in rows:
        key = (row.provider_code, row.internal_point_id, row.external_point_id)
        bucket = grouped.setdefault(
            key,
            {
                "provider_code": row.provider_code,
                "internal_point_id": row.internal_point_id,
                "external_point_id": row.external_point_id,
                "point_name": row.point_name,
                "point_views": 0,
                "successful_reservations": 0,
                "failed_reservations": 0,
                "status_checks": 0,
            },
        )
        if not bucket["point_name"] and row.point_name:
            bucket["point_name"] = row.point_name
        bucket["point_views"] += row.point_views
        bucket["successful_reservations"] += row.successful_reservations
        bucket["failed_reservations"] += row.failed_reservations
        bucket["status_checks"] += row.status_checks
    sort_key = "point_views" if metric == "views" else "successful_reservations"
    ordered = sorted(grouped.values(), key=lambda bucket: bucket[sort_key], reverse=True)
    return [PointMetricResponse(**bucket) for bucket in ordered[:limit]]


def provider_status_distribution(db: Session, provider_code: str | None) -> dict[str, int]:
    query = select(ProviderStatusDailyMetric)
    if provider_code:
        query = query.where(ProviderStatusDailyMetric.provider_code == provider_code)
    rows = db.scalars(query).all()
    distribution: dict[str, int] = {}
    for row in rows:
        distribution[row.status] = distribution.get(row.status, 0) + row.count
    return distribution


def freshness_response(db: Session, provider_code: str | None) -> FreshnessResponse:
    event_query = select(func.max(UsageEvent.ingested_at))
    aggregate_query = select(func.max(ProviderDailyMetric.last_computed_at))
    catalog_query = select(CatalogHealthSnapshot)
    if provider_code:
        event_query = event_query.where(UsageEvent.provider_code == provider_code)
        aggregate_query = aggregate_query.where(ProviderDailyMetric.provider_code == provider_code)
        catalog_query = catalog_query.where(CatalogHealthSnapshot.provider_code == provider_code)
    last_event = db.scalar(event_query)
    last_aggregate = db.scalar(aggregate_query)
    catalog_snapshot = db.scalar(
        catalog_query.order_by(CatalogHealthSnapshot.occurred_at.desc()).limit(1),
    )
    notice = "no_events_ingested"
    if last_event and last_aggregate:
        notice = "aggregates_current" if last_aggregate >= last_event else "aggregates_may_be_stale"
    elif last_event:
        notice = "aggregates_not_refreshed"
    return FreshnessResponse(
        provider_code=provider_code,
        last_event_ingested_at=last_event.isoformat() if last_event else None,
        last_aggregate_computed_at=last_aggregate.isoformat() if last_aggregate else None,
        last_catalog_import_at=catalog_snapshot.occurred_at.isoformat() if catalog_snapshot else None,
        latest_catalog_import_status=catalog_snapshot.latest_import_status if catalog_snapshot else None,
        analytics_delay_notice=notice,
    )


def provider_comparison_rows(db: Session) -> list[dict]:
    metrics = db.scalars(select(ProviderDailyMetric)).all()
    grouped: dict[str, dict] = {}
    for metric in metrics:
        bucket = grouped.setdefault(
            metric.provider_code,
            {
                "provider_code": metric.provider_code,
                "total_searches": 0,
                "total_point_views": 0,
                "total_status_checks": 0,
                "successful_reservations": 0,
                "failed_reservations": 0,
                "observed_amount": 0.0,
            },
        )
        bucket["total_searches"] += metric.searches
        bucket["total_point_views"] += metric.point_views
        bucket["total_status_checks"] += metric.status_checks
        bucket["successful_reservations"] += metric.successful_reservations
        bucket["failed_reservations"] += metric.failed_reservations
        bucket["observed_amount"] += metric.observed_amount
    for bucket in grouped.values():
        bucket["reservation_conversion_rate"] = conversion_rate(
            bucket["successful_reservations"],
            bucket["total_point_views"],
        )
    return sorted(grouped.values(), key=lambda row: row["provider_code"])


def operator_daily_rows(metrics: list[OperatorDailyMetric]) -> list[dict]:
    return [
        {
            "day_bucket": metric.day_bucket.isoformat(),
            "total_searches": metric.total_searches,
            "total_point_views": metric.total_point_views,
            "total_status_checks": metric.total_status_checks,
            "successful_reservations": metric.successful_reservations,
            "failed_reservations": metric.failed_reservations,
            "global_conversion_rate": conversion_rate(
                metric.successful_reservations,
                metric.total_point_views,
            ),
        }
        for metric in metrics
    ]


def catalog_health_rows(db: Session) -> list[dict]:
    rows = db.scalars(select(CatalogHealthSnapshot).order_by(CatalogHealthSnapshot.occurred_at.asc())).all()
    latest_by_provider: dict[str | None, CatalogHealthSnapshot] = {}
    for row in rows:
        latest_by_provider[row.provider_code] = row
    return [
        {
            "provider_code": row.provider_code,
            "active_count": row.active_count,
            "stale_count": row.stale_count,
            "imported_count": row.imported_count,
            "latest_import_status": row.latest_import_status,
            "occurred_at": row.occurred_at.isoformat(),
        }
        for row in latest_by_provider.values()
    ]


def usage_events_for_export(
    db: Session,
    provider_code: str | None,
    from_date: date | None,
    to_date: date | None,
) -> list[UsageEvent]:
    query = select(UsageEvent)
    if provider_code:
        query = query.where(UsageEvent.provider_code == provider_code)
    if from_date:
        query = query.where(UsageEvent.occurred_at >= datetime.combine(from_date, time.min, tzinfo=UTC))
    if to_date:
        query = query.where(UsageEvent.occurred_at < datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=UTC))
    return db.scalars(query.order_by(UsageEvent.occurred_at.asc())).all()


def conversion_rate(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return round(numerator / denominator, 4)
