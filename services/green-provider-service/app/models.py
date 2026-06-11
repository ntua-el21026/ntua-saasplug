from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class ProviderPointSnapshot(Base):
    __tablename__ = "provider_point_snapshots"
    __table_args__ = (
        UniqueConstraint("provider_code", "external_point_id", name="uq_provider_point"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_point_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    normalized_point_id: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    reservation_ends_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    price_per_kwh_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    connector: Mapped[str | None] = mapped_column(String(128), nullable=True)
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )


class RawProviderPayload(Base):
    __tablename__ = "raw_provider_payloads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    external_point_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    payload: Mapped[dict | list] = mapped_column(JSON, nullable=False)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class ProviderSyncRun(Base):
    __tablename__ = "provider_sync_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fetched_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    upserted_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class ProviderPointChange(Base):
    __tablename__ = "provider_point_changes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_point_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    normalized_point_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    change_type: Mapped[str] = mapped_column(String(32), nullable=False)
    changed_fields: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
