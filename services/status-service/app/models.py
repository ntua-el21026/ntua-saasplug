from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class StatusCache(Base):
    __tablename__ = "status_cache"
    __table_args__ = (
        UniqueConstraint("provider_code", "external_point_id", name="uq_status_cache_provider_point"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_point_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    normalized_point_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown", index=True)
    reservation_ends_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="provider_live")
    raw_provider_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    last_error_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )


class StatusCachePolicy(Base):
    __tablename__ = "status_cache_policy"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    ttl_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )


class StatusCheckLog(Base):
    __tablename__ = "status_check_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_point_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    normalized_point_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    requested_by_user_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    requested_by_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    requested_by_roles: Mapped[list] = mapped_column(JSON, nullable=False)
    requested_by_provider_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cache_hit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    force_refresh: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    result_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    returned_stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    provider_called: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    provider_error_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
