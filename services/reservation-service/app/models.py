from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    user_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_point_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    normalized_point_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    catalog_point_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    requested_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    provider_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    provider_reservation_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    reservation_ends_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    price_per_kwh_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    charger_capacity_kw: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_energy_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_cost_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_cost_currency: Mapped[str | None] = mapped_column(String(16), nullable=True)
    estimate_basis: Mapped[str | None] = mapped_column(String(128), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_provider_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )


class ReservationAttempt(Base):
    __tablename__ = "reservation_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    reservation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("reservations.id"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    user_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    requested_by_roles: Mapped[list] = mapped_column(JSON, nullable=False)
    requested_by_provider_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_point_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    normalized_point_id: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    requested_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    provider_called: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    result_status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    provider_error_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ReservationEventOutbox(Base):
    __tablename__ = "reservation_event_outbox"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    event_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, default=new_id)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    event_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    correlation_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    aggregate_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    producer: Mapped[str] = mapped_column(String(128), nullable=False, default="reservation-service")
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    publish_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    publish_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_publish_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_publish_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
