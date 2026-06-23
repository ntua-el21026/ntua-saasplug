from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import Date, DateTime, Float, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    event_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    event_version: Mapped[int] = mapped_column(Integer, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    correlation_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    producer: Mapped[str] = mapped_column(String(128), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    provider_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    internal_point_id: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    external_point_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    point_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    reservation_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    status: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(16), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


class ProviderHourlyMetric(Base):
    __tablename__ = "provider_hourly_metrics"
    __table_args__ = (UniqueConstraint("provider_code", "hour_bucket", name="uq_provider_hourly_bucket"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    hour_bucket: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    searches: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    point_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status_checks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    successful_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    observed_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str | None] = mapped_column(String(16), nullable=True)
    last_computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class ProviderDailyMetric(Base):
    __tablename__ = "provider_daily_metrics"
    __table_args__ = (UniqueConstraint("provider_code", "day_bucket", name="uq_provider_daily_bucket"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    day_bucket: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    searches: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    point_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status_checks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    successful_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    conversion_numerator: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    conversion_denominator: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    observed_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str | None] = mapped_column(String(16), nullable=True)
    last_computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class PointDailyMetric(Base):
    __tablename__ = "point_daily_metrics"
    __table_args__ = (
        UniqueConstraint(
            "provider_code",
            "day_bucket",
            "internal_point_id",
            "external_point_id",
            name="uq_point_daily_bucket",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    day_bucket: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    internal_point_id: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    external_point_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    point_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    point_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    successful_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status_checks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class ProviderStatusDailyMetric(Base):
    __tablename__ = "provider_status_daily_metrics"
    __table_args__ = (
        UniqueConstraint("provider_code", "day_bucket", "status", name="uq_provider_status_daily_bucket"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    day_bucket: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class OperatorDailyMetric(Base):
    __tablename__ = "operator_daily_metrics"
    __table_args__ = (UniqueConstraint("day_bucket", name="uq_operator_daily_bucket"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    day_bucket: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    total_searches: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_point_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_status_checks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    successful_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    conversion_numerator: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    conversion_denominator: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class EvReservationDailyMetric(Base):
    __tablename__ = "ev_reservation_daily_metrics"
    __table_args__ = (UniqueConstraint("user_id", "day_bucket", name="uq_ev_reservation_daily_bucket"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    day_bucket: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    total_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    successful_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_reservations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    missing_estimate_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_estimated_energy_kwh: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_estimated_cost_eur: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str | None] = mapped_column(String(16), nullable=True)
    point_keys: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    estimated_point_keys: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    last_computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class CatalogHealthSnapshot(Base):
    __tablename__ = "catalog_health_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    event_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    provider_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    active_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stale_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    imported_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latest_import_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


class BillingSummarySnapshot(Base):
    __tablename__ = "billing_summary_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    event_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    provider_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    invoice_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    invoiced_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    paid_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    unpaid_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(16), nullable=True)
    status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    actor_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    actor_role: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_provider_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    from_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    to_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
