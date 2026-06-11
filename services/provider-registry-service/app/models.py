from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    provider_code: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        unique=True,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    api_base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    api_key_env_var: Mapped[str | None] = mapped_column(String(120), nullable=True)
    api_auth_type: Mapped[str] = mapped_column(String(40), nullable=False, default="api_key")
    api_auth_header: Mapped[str | None] = mapped_column(String(120), nullable=True)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_seeded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
    )


class ProviderConfigAuditLog(Base):
    __tablename__ = "provider_config_audit_logs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    provider_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    actor_user_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    actor_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    actor_roles: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    changed_fields: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utcnow,
    )


Index(
    "ix_provider_config_audit_logs_provider_created",
    ProviderConfigAuditLog.provider_code,
    ProviderConfigAuditLog.created_at,
)
