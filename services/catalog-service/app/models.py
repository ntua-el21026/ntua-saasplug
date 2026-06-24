from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class CatalogPoint(Base):
    __tablename__ = "catalog_points"
    __table_args__ = (
        UniqueConstraint("provider_code", "external_point_id", name="uq_catalog_provider_point"),
        UniqueConstraint("normalized_point_id", name="uq_catalog_normalized_point"),
        Index("ix_catalog_points_latitude_longitude", "latitude", "longitude"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    normalized_point_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_point_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    coordinate_source: Mapped[str] = mapped_column(String(32), nullable=False, default="missing")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown", index=True)
    reservation_ends_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    price_per_kwh_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    connector: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    is_stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    last_provider_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
    )
    last_catalog_sync_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
    )
    raw_provider_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )


class CatalogImportRun(Base):
    __tablename__ = "catalog_import_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    triggered_by: Mapped[str | None] = mapped_column(String(320), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provider_sync_triggered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    provider_fetched_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    catalog_upserted_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    catalog_changed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    catalog_marked_stale_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class CatalogImportLock(Base):
    __tablename__ = "catalog_import_locks"

    provider_code: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_run_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class CatalogPointChange(Base):
    __tablename__ = "catalog_point_changes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_point_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    normalized_point_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    changed_fields: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
