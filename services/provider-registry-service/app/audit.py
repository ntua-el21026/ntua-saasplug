from sqlalchemy.orm import Session

from app.models import Provider, ProviderConfigAuditLog
from app.schemas import CurrentPrincipal


def record_audit_log(
    db: Session,
    provider: Provider,
    action: str,
    changed_fields: dict,
    actor: CurrentPrincipal | None = None,
) -> None:
    db.add(
        ProviderConfigAuditLog(
            provider_id=provider.id,
            provider_code=provider.provider_code,
            actor_user_id=actor.sub if actor else None,
            actor_email=actor.email if actor else "system",
            actor_roles=actor.roles if actor else ["SYSTEM"],
            action=action,
            changed_fields=changed_fields,
        ),
    )
