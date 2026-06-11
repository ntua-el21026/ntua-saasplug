from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit_log
from app.database import get_db
from app.dependencies import ensure_operator, ensure_provider_scope, get_current_principal
from app.models import Provider, ProviderConfigAuditLog
from app.schemas import (
    AuditLogResponse,
    CurrentPrincipal,
    ProviderCreateRequest,
    ProviderIntegrationConfigResponse,
    ProviderResponse,
    ProviderStatusRequest,
    ProviderUpdateRequest,
    Role,
)

router = APIRouter(tags=["providers"])

PROVIDER_ADMIN_EDITABLE_FIELDS = {"display_name", "legal_name", "contact_email"}
OPERATOR_EDITABLE_FIELDS = {
    "display_name",
    "legal_name",
    "contact_email",
    "api_base_url",
    "api_key_env_var",
    "api_auth_type",
    "api_auth_header",
    "timeout_seconds",
}


def provider_response(provider: Provider) -> ProviderResponse:
    return ProviderResponse(
        id=provider.id,
        provider_code=provider.provider_code,
        display_name=provider.display_name,
        legal_name=provider.legal_name,
        contact_email=provider.contact_email,
        api_base_url=provider.api_base_url,
        api_key_env_var=provider.api_key_env_var,
        api_auth_type=provider.api_auth_type,
        api_auth_header=provider.api_auth_header,
        timeout_seconds=provider.timeout_seconds,
        is_active=provider.is_active,
        is_seeded=provider.is_seeded,
    )


def integration_config_response(provider: Provider) -> ProviderIntegrationConfigResponse:
    return ProviderIntegrationConfigResponse(
        provider_code=provider.provider_code,
        api_base_url=provider.api_base_url,
        api_key_env_var=provider.api_key_env_var,
        api_auth_type=provider.api_auth_type,
        api_auth_header=provider.api_auth_header,
        timeout_seconds=provider.timeout_seconds,
        is_active=provider.is_active,
        secret_configured_elsewhere=provider.api_key_env_var is not None,
    )


def audit_response(audit_log: ProviderConfigAuditLog) -> AuditLogResponse:
    return AuditLogResponse(
        id=audit_log.id,
        provider_id=audit_log.provider_id,
        provider_code=audit_log.provider_code,
        actor_user_id=audit_log.actor_user_id,
        actor_email=audit_log.actor_email,
        actor_roles=audit_log.actor_roles,
        action=audit_log.action,
        changed_fields=audit_log.changed_fields,
        created_at=audit_log.created_at.isoformat(),
    )


def get_provider_or_404(db: Session, provider_code: str) -> Provider:
    provider = db.scalar(select(Provider).where(Provider.provider_code == provider_code))
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    return provider


def changed_field_map(provider: Provider, updates: dict[str, object]) -> dict[str, dict[str, object]]:
    changed_fields: dict[str, dict[str, object]] = {}
    for field, new_value in updates.items():
        old_value = getattr(provider, field)
        if old_value != new_value:
            setattr(provider, field, new_value)
            changed_fields[field] = {"old": old_value, "new": new_value}
    return changed_fields


@router.get("/providers", response_model=list[ProviderResponse])
def list_providers(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[ProviderResponse]:
    if Role.OPERATOR.value in principal.roles:
        providers = db.scalars(select(Provider).order_by(Provider.provider_code)).all()
        return [provider_response(provider) for provider in providers]
    if Role.PROVIDER_ADMIN.value in principal.roles and principal.provider_code:
        provider = get_provider_or_404(db, principal.provider_code)
        return [provider_response(provider)]
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")


@router.get("/providers/{provider_code}", response_model=ProviderResponse)
def read_provider(
    provider_code: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ProviderResponse:
    ensure_provider_scope(principal, provider_code)
    return provider_response(get_provider_or_404(db, provider_code))


@router.post("/providers", response_model=ProviderResponse, status_code=status.HTTP_201_CREATED)
def create_provider(
    request: ProviderCreateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ProviderResponse:
    ensure_operator(principal)
    existing_provider = db.scalar(
        select(Provider).where(Provider.provider_code == request.provider_code),
    )
    if existing_provider is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Provider already exists",
        )
    provider = Provider(
        provider_code=request.provider_code,
        display_name=request.display_name,
        legal_name=request.legal_name,
        contact_email=str(request.contact_email) if request.contact_email else None,
        api_base_url=request.api_base_url,
        api_key_env_var=request.api_key_env_var,
        api_auth_type=request.api_auth_type,
        api_auth_header=request.api_auth_header,
        timeout_seconds=request.timeout_seconds,
        is_active=request.is_active,
        is_seeded=False,
    )
    db.add(provider)
    db.flush()
    record_audit_log(
        db,
        provider,
        "created",
        {"provider_code": provider.provider_code},
        principal,
    )
    db.commit()
    db.refresh(provider)
    return provider_response(provider)


@router.patch("/providers/{provider_code}", response_model=ProviderResponse)
def update_provider(
    provider_code: str,
    request: ProviderUpdateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ProviderResponse:
    ensure_provider_scope(principal, provider_code)
    provider = get_provider_or_404(db, provider_code)
    allowed_fields = (
        OPERATOR_EDITABLE_FIELDS
        if Role.OPERATOR.value in principal.roles
        else PROVIDER_ADMIN_EDITABLE_FIELDS
    )
    updates = request.model_dump(exclude_unset=True)
    forbidden_fields = sorted(set(updates) - allowed_fields)
    if forbidden_fields:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Fields not editable for this role: {', '.join(forbidden_fields)}",
        )
    if "contact_email" in updates and updates["contact_email"] is not None:
        updates["contact_email"] = str(updates["contact_email"])

    changed_fields = changed_field_map(provider, updates)
    if changed_fields:
        record_audit_log(db, provider, "updated", changed_fields, principal)
        db.commit()
        db.refresh(provider)
    return provider_response(provider)


@router.patch("/providers/{provider_code}/status", response_model=ProviderResponse)
def update_provider_status(
    provider_code: str,
    request: ProviderStatusRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ProviderResponse:
    ensure_operator(principal)
    provider = get_provider_or_404(db, provider_code)
    changed_fields = changed_field_map(provider, {"is_active": request.is_active})
    if changed_fields:
        record_audit_log(db, provider, "status_changed", changed_fields, principal)
        db.commit()
        db.refresh(provider)
    return provider_response(provider)


@router.get(
    "/providers/{provider_code}/integration-config",
    response_model=ProviderIntegrationConfigResponse,
)
def read_integration_config(
    provider_code: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ProviderIntegrationConfigResponse:
    ensure_provider_scope(principal, provider_code)
    return integration_config_response(get_provider_or_404(db, provider_code))


@router.get("/providers/{provider_code}/audit-logs", response_model=list[AuditLogResponse])
def read_audit_logs(
    provider_code: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[AuditLogResponse]:
    ensure_provider_scope(principal, provider_code)
    get_provider_or_404(db, provider_code)
    audit_logs = db.scalars(
        select(ProviderConfigAuditLog)
        .where(ProviderConfigAuditLog.provider_code == provider_code)
        .order_by(ProviderConfigAuditLog.created_at.desc()),
    ).all()
    return [audit_response(audit_log) for audit_log in audit_logs]
