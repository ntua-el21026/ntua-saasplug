from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit_log
from app.config import Settings
from app.models import Provider, ProviderConfigAuditLog


def provider_id_for(provider_code: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"https://saasplug.local/providers/{provider_code}"))


def seed_provider_rows(settings: Settings) -> tuple[dict, ...]:
    return (
        {
            "id": provider_id_for("redPlug"),
            "provider_code": "redPlug",
            "display_name": "redPlug",
            "legal_name": "redPlug",
            "contact_email": "red-admin@saasplug.local",
            "api_base_url": settings.red_provider_base_url,
            "api_key_env_var": "RED_PROVIDER_API_KEY",
            "api_auth_type": "api_key",
            "api_auth_header": "Authorization",
            "timeout_seconds": settings.default_timeout_seconds,
            "is_active": True,
            "is_seeded": True,
        },
        {
            "id": provider_id_for("greenPlug"),
            "provider_code": "greenPlug",
            "display_name": "greenPlug",
            "legal_name": "greenPlug",
            "contact_email": "green-admin@saasplug.local",
            "api_base_url": settings.green_provider_base_url,
            "api_key_env_var": "GREEN_PROVIDER_API_KEY",
            "api_auth_type": "api_key",
            "api_auth_header": "Authorization",
            "timeout_seconds": settings.default_timeout_seconds,
            "is_active": True,
            "is_seeded": True,
        },
        {
            "id": provider_id_for("bluePlug"),
            "provider_code": "bluePlug",
            "display_name": "bluePlug",
            "legal_name": "bluePlug",
            "contact_email": "blue-admin@saasplug.local",
            "api_base_url": settings.blue_provider_base_url,
            "api_key_env_var": "BLUE_PROVIDER_API_KEY",
            "api_auth_type": "api_key",
            "api_auth_header": "Authorization",
            "timeout_seconds": settings.default_timeout_seconds,
            "is_active": True,
            "is_seeded": True,
        },
    )


def seed_providers(db: Session, settings: Settings) -> None:
    for seed_provider in seed_provider_rows(settings):
        provider = db.scalar(
            select(Provider).where(
                Provider.provider_code == seed_provider["provider_code"],
            ),
        )
        if provider is None:
            provider = Provider(**seed_provider)
            db.add(provider)
            db.flush()
            record_audit_log(
                db,
                provider,
                "seeded",
                {"provider_code": provider.provider_code},
            )
            continue

        changed_fields: dict[str, dict[str, object]] = {}
        for field in (
            "display_name",
            "legal_name",
            "contact_email",
            "api_base_url",
            "api_key_env_var",
            "api_auth_type",
            "api_auth_header",
            "timeout_seconds",
            "is_active",
            "is_seeded",
        ):
            new_value = seed_provider[field]
            old_value = getattr(provider, field)
            if old_value != new_value:
                setattr(provider, field, new_value)
                changed_fields[field] = {"old": old_value, "new": new_value}
        if changed_fields:
            record_audit_log(db, provider, "seed_updated", changed_fields)

    db.commit()


def seed_audit_count(db: Session) -> int:
    return len(db.scalars(select(ProviderConfigAuditLog)).all())
