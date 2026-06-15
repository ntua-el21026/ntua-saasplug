import math

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.config import PROVIDER_CODES, Settings, get_settings
from app.database import get_db
from app.event_publisher import publish_best_effort_event
from app.importer import import_provider_catalog, validate_provider_code
from app.models import CatalogImportRun, CatalogPoint
from app.provider_client import ProviderServiceClient
from app.schemas import (
    CatalogPointDetailResponse,
    CatalogPointListResponse,
    CatalogPointResponse,
    CatalogSearchCircleResponse,
    CurrentPrincipal,
    ImportAllResponse,
    ImportRunResponse,
    ImportSummaryResponse,
    ProviderFreshnessResponse,
)
from app.security import ensure_import_run_reader, ensure_operator, get_current_principal, get_optional_principal
from saasplug_events.routing import EventType

router = APIRouter(tags=["catalog"])
EARTH_RADIUS_KM = 6371.0088


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


def point_response(point: CatalogPoint) -> CatalogPointResponse:
    return CatalogPointResponse(
        id=point.id,
        normalized_point_id=point.normalized_point_id,
        provider_code=point.provider_code,
        external_point_id=point.external_point_id,
        display_name=point.display_name,
        location_name=point.location_name,
        address=point.address,
        latitude=point.latitude,
        longitude=point.longitude,
        coordinate_source=point.coordinate_source,
        status=point.status,
        reservation_ends_at=point.reservation_ends_at,
        price_per_kwh_eur=point.price_per_kwh_eur,
        capacity=point.capacity,
        connector=point.connector,
        is_active=point.is_active,
        is_stale=point.is_stale,
        last_provider_seen_at=point.last_provider_seen_at.isoformat(),
        last_catalog_sync_at=point.last_catalog_sync_at.isoformat(),
    )


def point_detail_response(point: CatalogPoint) -> CatalogPointDetailResponse:
    response = point_response(point).model_dump()
    response["raw_provider_payload"] = point.raw_provider_payload
    return CatalogPointDetailResponse(**response)


def import_run_response(import_run: CatalogImportRun) -> ImportRunResponse:
    return ImportRunResponse(
        id=import_run.id,
        provider_code=import_run.provider_code,
        status=import_run.status,
        triggered_by=import_run.triggered_by,
        started_at=import_run.started_at.isoformat(),
        completed_at=import_run.completed_at.isoformat() if import_run.completed_at else None,
        provider_sync_triggered=import_run.provider_sync_triggered,
        provider_fetched_count=import_run.provider_fetched_count,
        catalog_upserted_count=import_run.catalog_upserted_count,
        catalog_changed_count=import_run.catalog_changed_count,
        catalog_marked_stale_count=import_run.catalog_marked_stale_count,
        error_message=import_run.error_message,
    )


def base_point_filters(
    include_stale: bool,
    provider_code: str | None,
    status_filter: str | None,
    connector: str | None,
    q: str | None,
) -> list:
    filters = []
    if not include_stale:
        filters.extend([CatalogPoint.is_active.is_(True), CatalogPoint.is_stale.is_(False)])
    if provider_code:
        filters.append(CatalogPoint.provider_code == provider_code)
    if status_filter:
        filters.append(CatalogPoint.status == status_filter)
    if connector:
        filters.append(CatalogPoint.connector == connector)
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                CatalogPoint.display_name.ilike(pattern),
                CatalogPoint.location_name.ilike(pattern),
                CatalogPoint.address.ilike(pattern),
                CatalogPoint.normalized_point_id.ilike(pattern),
            ),
        )
    return filters


def radius_prefilter_bounds(center_lat: float, center_lng: float, radius_km: float) -> list:
    lng_scale = max(0.2, math.cos(math.radians(center_lat)))
    lat_radius = radius_km / 111.32
    lng_radius = radius_km / (111.32 * lng_scale)
    return [
        CatalogPoint.latitude >= center_lat - lat_radius,
        CatalogPoint.latitude <= center_lat + lat_radius,
        CatalogPoint.longitude >= center_lng - lng_radius,
        CatalogPoint.longitude <= center_lng + lng_radius,
    ]


def point_within_radius(point: CatalogPoint, center_lat: float, center_lng: float, radius_km: float) -> bool:
    if point.latitude is None or point.longitude is None:
        return False
    lat_delta = math.radians(point.latitude - center_lat)
    lng_delta = math.radians(point.longitude - center_lng)
    center_lat_rad = math.radians(center_lat)
    point_lat_rad = math.radians(point.latitude)
    haversine = (
        math.sin(lat_delta / 2) ** 2
        + math.cos(center_lat_rad) * math.cos(point_lat_rad) * math.sin(lng_delta / 2) ** 2
    )
    distance_km = 2 * EARTH_RADIUS_KM * math.asin(min(1, math.sqrt(haversine)))
    return distance_km <= radius_km + 1e-9


@router.get("/points", response_model=CatalogPointListResponse)
def list_points(
    min_lat: float | None = Query(default=None, alias="minLat"),
    max_lat: float | None = Query(default=None, alias="maxLat"),
    min_lng: float | None = Query(default=None, alias="minLng"),
    max_lng: float | None = Query(default=None, alias="maxLng"),
    center_lat: float | None = Query(default=None, alias="centerLat"),
    center_lng: float | None = Query(default=None, alias="centerLng"),
    radius_km: float | None = Query(default=None, alias="radiusKm", gt=0),
    provider_code: str | None = Query(default=None, alias="providerCode"),
    status_filter: str | None = Query(default=None, alias="status"),
    connector: str | None = None,
    q: str | None = None,
    include_stale: bool = Query(default=False, alias="includeStale"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal | None = Depends(get_optional_principal),
) -> CatalogPointListResponse:
    if provider_code:
        try:
            validate_provider_code(provider_code)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    bounds_values = (min_lat, max_lat, min_lng, max_lng)
    bounds_applied = any(value is not None for value in bounds_values)
    if bounds_applied and not all(value is not None for value in bounds_values):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="All bounds must be provided")
    if bounds_applied and (min_lat > max_lat or min_lng > max_lng):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid bounds")
    radius_values = (center_lat, center_lng, radius_km)
    radius_applied = any(value is not None for value in radius_values)
    if radius_applied and not all(value is not None for value in radius_values):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="All radius parameters must be provided")
    if radius_applied and not (-90 <= center_lat <= 90 and -180 <= center_lng <= 180):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid radius center")

    filters = base_point_filters(include_stale, provider_code, status_filter, connector, q)
    missing_coordinates_count = db.scalar(
        select(func.count())
        .select_from(CatalogPoint)
        .where(
            *filters,
            or_(CatalogPoint.latitude.is_(None), CatalogPoint.longitude.is_(None)),
        ),
    ) or 0

    query = select(CatalogPoint).where(*filters)
    if bounds_applied:
        query = query.where(
            CatalogPoint.latitude.is_not(None),
            CatalogPoint.longitude.is_not(None),
            CatalogPoint.latitude >= min_lat,
            CatalogPoint.latitude <= max_lat,
            CatalogPoint.longitude >= min_lng,
            CatalogPoint.longitude <= max_lng,
        )
    if radius_applied:
        query = query.where(
            CatalogPoint.latitude.is_not(None),
            CatalogPoint.longitude.is_not(None),
            *radius_prefilter_bounds(center_lat, center_lng, radius_km),
        )
    ordered_query = query.order_by(CatalogPoint.provider_code, CatalogPoint.external_point_id)
    if radius_applied:
        exact_radius_points = [
            point
            for point in db.scalars(ordered_query).all()
            if point_within_radius(point, center_lat, center_lng, radius_km)
        ]
        total = len(exact_radius_points)
        points = exact_radius_points[offset:offset + limit]
    else:
        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        points = db.scalars(ordered_query.offset(offset).limit(limit)).all()
    response = CatalogPointListResponse(
        items=[point_response(point) for point in points],
        total=total,
        limit=limit,
        offset=offset,
        bounds_applied=bounds_applied or radius_applied,
        missing_coordinates_count=missing_coordinates_count,
        search_circle=CatalogSearchCircleResponse(
            center_lat=center_lat,
            center_lng=center_lng,
            radius_km=radius_km,
        ) if radius_applied else None,
    )
    if offset == 0:
        publish_search_event(
            settings,
            principal,
            response,
            provider_code=provider_code,
            status_filter=status_filter,
            connector=connector,
            q=q,
            include_stale=include_stale,
            bounds_applied=bounds_applied,
            radius_applied=radius_applied,
        )
    return response


@router.get("/points/{provider_code}/{external_point_id}", response_model=CatalogPointDetailResponse)
def read_point_detail(
    provider_code: str,
    external_point_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal | None = Depends(get_optional_principal),
) -> CatalogPointDetailResponse:
    point = db.scalar(
        select(CatalogPoint).where(
            CatalogPoint.provider_code == provider_code,
            CatalogPoint.external_point_id == external_point_id,
        ),
    )
    if point is None or not point.is_active or point.is_stale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog point not found")
    response = point_detail_response(point)
    publish_point_view_event(settings, principal, response)
    return response


@router.post("/imports/providers/{provider_code}", response_model=ImportSummaryResponse)
def import_provider(
    provider_code: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ImportSummaryResponse:
    try:
        validate_provider_code(provider_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    ensure_operator(principal)
    provider_client = ProviderServiceClient(settings)
    try:
        summary = import_provider_catalog(db, provider_code, principal.email, provider_client)
    finally:
        provider_client.close()
    if summary.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "provider_code": summary.provider_code,
                "run_id": summary.run_id,
                "message": "Catalog import failed for provider service",
            },
        )
    publish_import_event(settings, summary)
    return summary


@router.post("/imports/all", response_model=ImportAllResponse)
def import_all_providers(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ImportAllResponse:
    ensure_operator(principal)
    provider_client = ProviderServiceClient(settings)
    summaries: list[ImportSummaryResponse] = []
    try:
        for provider_code in PROVIDER_CODES:
            summary = import_provider_catalog(db, provider_code, principal.email, provider_client)
            summaries.append(summary)
            if summary.status == "completed":
                publish_import_event(settings, summary)
    finally:
        provider_client.close()
    completed = sum(1 for summary in summaries if summary.status == "completed")
    overall_status = "completed" if completed == len(summaries) else "partial"
    return ImportAllResponse(status=overall_status, providers=summaries)


@router.post("/internal/jobs/catalog/imports/providers/{provider_code}", response_model=ImportSummaryResponse)
def import_provider_from_scheduler(
    provider_code: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: str = Depends(require_scheduler_job),
) -> ImportSummaryResponse:
    try:
        validate_provider_code(provider_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    provider_client = ProviderServiceClient(settings)
    try:
        summary = import_provider_catalog(db, provider_code, "scheduler-service", provider_client)
    finally:
        provider_client.close()
    if summary.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "provider_code": summary.provider_code,
                "run_id": summary.run_id,
                "message": "Catalog import failed for provider service",
            },
        )
    publish_import_event(settings, summary)
    return summary


@router.post("/internal/jobs/catalog/imports/all", response_model=ImportAllResponse)
def import_all_providers_from_scheduler(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: str = Depends(require_scheduler_job),
) -> ImportAllResponse:
    provider_client = ProviderServiceClient(settings)
    summaries: list[ImportSummaryResponse] = []
    try:
        for provider_code in PROVIDER_CODES:
            summary = import_provider_catalog(db, provider_code, "scheduler-service", provider_client)
            summaries.append(summary)
            if summary.status == "completed":
                publish_import_event(settings, summary)
    finally:
        provider_client.close()
    completed = sum(1 for summary in summaries if summary.status == "completed")
    overall_status = "completed" if completed == len(summaries) else "partial"
    return ImportAllResponse(status=overall_status, providers=summaries)


@router.get("/imports/runs", response_model=list[ImportRunResponse])
def list_import_runs(
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[ImportRunResponse]:
    ensure_import_run_reader(principal)
    query = select(CatalogImportRun)
    if "PROVIDER_ADMIN" in principal.roles and "OPERATOR" not in principal.roles:
        query = query.where(CatalogImportRun.provider_code == principal.provider_code)
    import_runs = db.scalars(
        query.order_by(CatalogImportRun.started_at.desc()).limit(limit),
    ).all()
    return [import_run_response(import_run) for import_run in import_runs]


@router.get("/freshness", response_model=list[ProviderFreshnessResponse])
def read_freshness(db: Session = Depends(get_db)) -> list[ProviderFreshnessResponse]:
    return catalog_freshness(db)


@router.get("/internal/jobs/catalog/freshness", response_model=list[ProviderFreshnessResponse])
def read_internal_freshness(
    db: Session = Depends(get_db),
    _: str = Depends(require_scheduler_job),
) -> list[ProviderFreshnessResponse]:
    return catalog_freshness(db)


def catalog_freshness(db: Session) -> list[ProviderFreshnessResponse]:
    freshness: list[ProviderFreshnessResponse] = []
    for provider_code in PROVIDER_CODES:
        active_count = db.scalar(
            select(func.count())
            .select_from(CatalogPoint)
            .where(
                CatalogPoint.provider_code == provider_code,
                CatalogPoint.is_active.is_(True),
                CatalogPoint.is_stale.is_(False),
            ),
        ) or 0
        stale_count = db.scalar(
            select(func.count())
            .select_from(CatalogPoint)
            .where(CatalogPoint.provider_code == provider_code, CatalogPoint.is_stale.is_(True)),
        ) or 0
        last_successful_import = db.scalar(
            select(CatalogImportRun)
            .where(
                CatalogImportRun.provider_code == provider_code,
                CatalogImportRun.status == "completed",
            )
            .order_by(CatalogImportRun.completed_at.desc())
            .limit(1),
        )
        last_import = db.scalar(
            select(CatalogImportRun)
            .where(CatalogImportRun.provider_code == provider_code)
            .order_by(CatalogImportRun.started_at.desc())
            .limit(1),
        )
        freshness.append(
            ProviderFreshnessResponse(
                provider_code=provider_code,
                active_count=active_count,
                stale_count=stale_count,
                last_successful_import_at=(
                    last_successful_import.completed_at.isoformat()
                    if last_successful_import and last_successful_import.completed_at
                    else None
                ),
                last_import_status=last_import.status if last_import else None,
            ),
        )
    return freshness


def publish_search_event(
    settings: Settings,
    principal: CurrentPrincipal | None,
    response: CatalogPointListResponse,
    *,
    provider_code: str | None,
    status_filter: str | None,
    connector: str | None,
    q: str | None,
    include_stale: bool,
    bounds_applied: bool,
    radius_applied: bool,
) -> None:
    matched_provider_codes = sorted({point.provider_code for point in response.items})
    payload = {
        "user_id": principal.sub if principal else None,
        "provider_code": provider_code,
        "matched_provider_codes": matched_provider_codes,
        "search_term": q.strip()[:120] if q and q.strip() else None,
        "status_filter": status_filter,
        "connector": connector,
        "include_stale": include_stale,
        "bounds_applied": bounds_applied,
        "radius_applied": radius_applied,
        "result_count": len(response.items),
        "total": response.total,
        "limit": response.limit,
        "offset": response.offset,
    }
    publish_best_effort_event(
        settings,
        event_type=EventType.USAGE_SEARCH_PERFORMED.value,
        payload=payload,
    )


def publish_point_view_event(
    settings: Settings,
    principal: CurrentPrincipal | None,
    point: CatalogPointDetailResponse,
) -> None:
    payload = {
        "user_id": principal.sub if principal else None,
        "provider_code": point.provider_code,
        "internal_point_id": point.normalized_point_id,
        "normalized_point_id": point.normalized_point_id,
        "external_point_id": point.external_point_id,
        "point_name": point.display_name,
        "status": point.status,
    }
    publish_best_effort_event(
        settings,
        event_type=EventType.USAGE_POINT_VIEWED.value,
        payload=payload,
    )


def publish_import_event(settings: Settings, summary: ImportSummaryResponse) -> None:
    if summary.status != "completed":
        return
    payload = {
        "provider_code": summary.provider_code,
        "import_run_id": summary.run_id,
        "status": summary.status,
        "provider_sync_triggered": summary.provider_sync_triggered,
        "provider_fetched_count": summary.provider_fetched_count,
        "catalog_upserted_count": summary.catalog_upserted_count,
        "catalog_changed_count": summary.catalog_changed_count,
        "catalog_marked_stale_count": summary.catalog_marked_stale_count,
        "imported_count": summary.catalog_upserted_count,
        "active_count": summary.catalog_upserted_count,
        "stale_count": summary.catalog_marked_stale_count,
    }
    publish_best_effort_event(
        settings,
        event_type=EventType.CATALOG_POINTS_IMPORTED.value,
        payload=payload,
    )
