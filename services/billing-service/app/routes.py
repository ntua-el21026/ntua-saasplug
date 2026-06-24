from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.event_ingestion import BillingIngestResult, ingest_event
from app.event_publisher import build_billing_publisher, publish_pending_outbox
from app.invoicing import issue_invoice, pay_invoice
from app.models import BillingEventOutbox, ChargeRecord, Invoice, InvoiceLine, Payment, PricingRule
from app.pricing import (
    create_pricing_rule,
    get_effective_pricing_rule,
    pricing_rule_response,
    update_pricing_rule,
    validate_provider_code,
)
from app.rabbitmq_consumer import consume_billing_events
from app.schemas import (
    BillingOverviewResponse,
    ChargeResponse,
    CurrentPrincipal,
    DrainResponse,
    IngestResponse,
    IngestResultResponse,
    InvoiceIssueRequest,
    InvoiceLineResponse,
    InvoiceResponse,
    MockPaymentRequest,
    OutboxPublishResponse,
    PaymentResponse,
    PricingRuleCreate,
    PricingRulePatch,
    PricingRuleResponse,
)
from app.security import (
    ensure_operator,
    ensure_provider_admin_or_operator,
    get_current_principal,
    is_operator,
    resolve_provider_scope,
)
from saasplug_events.envelope import EventEnvelope

router = APIRouter(tags=["billing"])


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


@router.post("/events/ingest", response_model=IngestResponse)
def ingest_events_endpoint(
    body: Annotated[EventEnvelope | list[EventEnvelope], Body()],
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> IngestResponse:
    ensure_operator(principal)
    envelopes = body if isinstance(body, list) else [body]
    return ingest_response([ingest_event(db, envelope, settings) for envelope in envelopes])


@router.post("/events/drain", response_model=DrainResponse)
def drain_events_endpoint(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> DrainResponse:
    ensure_operator(principal)
    effective_limit = min(limit, settings.rabbitmq_consume_batch_size)
    result = consume_billing_events(settings, db, effective_limit)
    return DrainResponse(**result.__dict__)


@router.post("/events/outbox/publish-pending", response_model=OutboxPublishResponse)
def publish_pending_billing_outbox_endpoint(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> OutboxPublishResponse:
    ensure_operator(principal)
    publisher = build_billing_publisher(settings)
    try:
        result = publish_pending_outbox(db, publisher, limit)
    finally:
        publisher.close()
    return OutboxPublishResponse(**result.__dict__)


@router.post("/internal/jobs/events/drain", response_model=DrainResponse)
def drain_events_from_scheduler(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: str = Depends(require_scheduler_job),
) -> DrainResponse:
    effective_limit = min(limit, settings.rabbitmq_consume_batch_size)
    result = consume_billing_events(settings, db, effective_limit)
    return DrainResponse(**result.__dict__)


@router.post("/internal/jobs/outbox/publish-pending", response_model=OutboxPublishResponse)
def publish_pending_billing_outbox_from_scheduler(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: str = Depends(require_scheduler_job),
) -> OutboxPublishResponse:
    publisher = build_billing_publisher(settings)
    try:
        result = publish_pending_outbox(db, publisher, limit)
    finally:
        publisher.close()
    return OutboxPublishResponse(**result.__dict__)


@router.post("/internal/jobs/invoices/prepare")
def prepare_invoice_candidates_from_scheduler(
    db: Session = Depends(get_db),
    _: str = Depends(require_scheduler_job),
) -> dict:
    rows = db.execute(
        select(
            ChargeRecord.provider_code,
            ChargeRecord.currency,
            func.count(ChargeRecord.id),
            func.coalesce(func.sum(ChargeRecord.amount), 0),
        )
        .where(ChargeRecord.status == "unbilled")
        .group_by(ChargeRecord.provider_code, ChargeRecord.currency)
        .order_by(ChargeRecord.provider_code.asc()),
    ).all()
    providers = [
        {
            "provider_code": provider_code,
            "currency": currency,
            "unbilled_charge_count": int(charge_count),
            "subtotal_amount": str(subtotal_amount),
        }
        for provider_code, currency, charge_count, subtotal_amount in rows
    ]
    return {
        "status": "prepared",
        "candidate_provider_count": len(providers),
        "total_unbilled_charge_count": sum(row["unbilled_charge_count"] for row in providers),
        "providers": providers,
    }


@router.get("/internal/jobs/freshness")
def read_internal_freshness(
    db: Session = Depends(get_db),
    _: str = Depends(require_scheduler_job),
) -> dict:
    pending_outbox_count = db.scalar(
        select(func.count()).select_from(BillingEventOutbox).where(BillingEventOutbox.publish_status == "pending"),
    ) or 0
    unbilled_charge_count = db.scalar(
        select(func.count()).select_from(ChargeRecord).where(ChargeRecord.status == "unbilled"),
    ) or 0
    last_charge_at = db.scalar(select(func.max(ChargeRecord.created_at)))
    last_invoice_at = db.scalar(select(func.max(Invoice.created_at)))
    return {
        "pending_outbox_count": pending_outbox_count,
        "unbilled_charge_count": unbilled_charge_count,
        "last_charge_at": last_charge_at.isoformat() if last_charge_at else None,
        "last_invoice_at": last_invoice_at.isoformat() if last_invoice_at else None,
    }


@router.get("/pricing/rules", response_model=list[PricingRuleResponse])
def list_pricing_rules(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[PricingRuleResponse]:
    ensure_operator(principal)
    rules = db.scalars(select(PricingRule).order_by(PricingRule.provider_code.asc(), PricingRule.created_at.desc())).all()
    return [pricing_rule_response(rule) for rule in rules]


@router.post("/pricing/rules", response_model=PricingRuleResponse, status_code=status.HTTP_201_CREATED)
def create_pricing_rule_endpoint(
    body: PricingRuleCreate,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> PricingRuleResponse:
    ensure_operator(principal)
    return pricing_rule_response(create_pricing_rule(db, body, principal.email))


@router.patch("/pricing/rules/{rule_id}", response_model=PricingRuleResponse)
def update_pricing_rule_endpoint(
    rule_id: str,
    body: PricingRulePatch,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> PricingRuleResponse:
    ensure_operator(principal)
    rule = get_pricing_rule_or_404(db, rule_id)
    return pricing_rule_response(update_pricing_rule(db, rule, body))


@router.get("/pricing/effective/{provider_code}", response_model=PricingRuleResponse)
def effective_pricing(
    provider_code: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> PricingRuleResponse:
    ensure_provider_admin_or_operator(principal)
    resolved_provider_code = resolve_provider_scope(principal, provider_code)
    assert resolved_provider_code is not None
    return pricing_rule_response(get_effective_pricing_rule(db, resolved_provider_code, settings))


@router.get("/charges", response_model=None)
def list_charges(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    status_filter: str | None = Query(default=None, alias="status"),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[dict[str, Any]]:
    ensure_provider_admin_or_operator(principal)
    resolved_provider_code = resolve_provider_scope(principal, provider_code)
    query = select(ChargeRecord)
    if resolved_provider_code:
        query = query.where(ChargeRecord.provider_code == resolved_provider_code)
    if status_filter:
        query = query.where(ChargeRecord.status == status_filter)
    if from_time:
        query = query.where(ChargeRecord.occurred_at >= from_time)
    if to_time:
        query = query.where(ChargeRecord.occurred_at <= to_time)
    charges = db.scalars(query.order_by(ChargeRecord.occurred_at.desc())).all()
    return [charge_payload_for_principal(charge, principal) for charge in charges]


@router.get("/charges/{charge_id}", response_model=None)
def get_charge(
    charge_id: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> dict[str, Any]:
    ensure_provider_admin_or_operator(principal)
    charge = get_charge_or_404(db, charge_id)
    resolve_provider_scope(principal, charge.provider_code)
    return charge_payload_for_principal(charge, principal)


@router.post("/invoices/issue", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def issue_invoice_endpoint(
    body: InvoiceIssueRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> InvoiceResponse:
    ensure_operator(principal)
    validate_provider_code(body.provider_code)
    invoice = issue_invoice(
        db,
        body.provider_code,
        body.period_start,
        body.period_end,
        body.tax_amount,
        principal.email,
    )
    return invoice_response(db, invoice)


@router.get("/invoices", response_model=list[InvoiceResponse])
def list_invoices(
    provider_code: str | None = Query(default=None, alias="providerCode"),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[InvoiceResponse]:
    ensure_provider_admin_or_operator(principal)
    resolved_provider_code = resolve_provider_scope(principal, provider_code)
    query = select(Invoice)
    if resolved_provider_code:
        query = query.where(Invoice.provider_code == resolved_provider_code)
    if status_filter:
        query = query.where(Invoice.status == status_filter)
    invoices = db.scalars(query.order_by(Invoice.issued_at.desc())).all()
    return [invoice_response(db, invoice) for invoice in invoices]


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> InvoiceResponse:
    ensure_provider_admin_or_operator(principal)
    invoice = get_invoice_or_404(db, invoice_id)
    resolve_provider_scope(principal, invoice.provider_code)
    return invoice_response(db, invoice)


@router.post("/invoices/{invoice_id}/pay", response_model=InvoiceResponse)
def pay_invoice_endpoint(
    invoice_id: str,
    body: MockPaymentRequest | None = None,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> InvoiceResponse:
    ensure_provider_admin_or_operator(principal)
    invoice = get_invoice_or_404(db, invoice_id)
    resolve_provider_scope(principal, invoice.provider_code)
    paid_invoice_payment = pay_invoice(
        db,
        invoice,
        principal.email,
        body.mock_payment_reference if body else None,
    )
    db.refresh(invoice)
    _ = paid_invoice_payment
    return invoice_response(db, invoice)


@router.get("/overview", response_model=BillingOverviewResponse)
def billing_overview(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> BillingOverviewResponse:
    ensure_provider_admin_or_operator(principal)
    provider_code = None if is_operator(principal) else principal.provider_code
    return overview_response(db, settings, provider_code, include_provider_rows=is_operator(principal))


@router.get("/providers/{provider_code}/overview", response_model=BillingOverviewResponse)
def provider_billing_overview(
    provider_code: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> BillingOverviewResponse:
    ensure_provider_admin_or_operator(principal)
    resolved_provider_code = resolve_provider_scope(principal, provider_code)
    assert resolved_provider_code is not None
    return overview_response(db, settings, resolved_provider_code, include_provider_rows=False)


def ingest_response(results: list[BillingIngestResult]) -> IngestResponse:
    return IngestResponse(
        charged_count=sum(1 for result in results if result.status == "charged"),
        skipped_count=sum(1 for result in results if result.status == "skipped"),
        duplicate_count=sum(1 for result in results if result.status == "duplicate"),
        unsupported_count=sum(1 for result in results if result.status == "unsupported"),
        failed_count=sum(1 for result in results if result.status == "failed"),
        results=[
            IngestResultResponse(
                event_id=result.event_id,
                event_type=result.event_type,
                result=result.status,
                charge_id=result.charge_id,
                message=result.message,
            )
            for result in results
        ],
    )


def get_pricing_rule_or_404(db: Session, rule_id: str) -> PricingRule:
    rule = db.get(PricingRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found")
    return rule


def get_charge_or_404(db: Session, charge_id: str) -> ChargeRecord:
    charge = db.get(ChargeRecord, charge_id)
    if charge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Charge not found")
    return charge


def get_invoice_or_404(db: Session, invoice_id: str) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return invoice


def charge_response(charge: ChargeRecord) -> ChargeResponse:
    return ChargeResponse(
        id=charge.id,
        source_event_id=charge.source_event_id,
        provider_code=charge.provider_code,
        event_type=charge.event_type,
        charge_type=charge.charge_type,
        amount=Decimal(str(charge.amount)),
        currency=charge.currency,
        status=charge.status,
        reservation_id=charge.reservation_id,
        internal_point_id=charge.internal_point_id,
        external_point_id=charge.external_point_id,
        user_id=charge.user_id,
        occurred_at=charge.occurred_at.isoformat(),
        pricing_rule_id=charge.pricing_rule_id,
        invoice_id=charge.invoice_id,
        created_at=charge.created_at.isoformat(),
    )


def provider_admin_charge_response(charge: ChargeRecord) -> dict[str, Any]:
    return {
        "id": charge.id,
        "source_event_id": charge.source_event_id,
        "provider_code": charge.provider_code,
        "event_type": charge.event_type,
        "charge_type": charge.charge_type,
        "amount": str(Decimal(str(charge.amount))),
        "currency": charge.currency,
        "status": charge.status,
        "internal_point_id": charge.internal_point_id,
        "external_point_id": charge.external_point_id,
        "occurred_at": charge.occurred_at.isoformat(),
        "pricing_rule_id": charge.pricing_rule_id,
        "invoice_id": charge.invoice_id,
        "created_at": charge.created_at.isoformat(),
    }


def charge_payload_for_principal(charge: ChargeRecord, principal: CurrentPrincipal) -> dict[str, Any]:
    if "PROVIDER_ADMIN" in principal.roles and "OPERATOR" not in principal.roles:
        return provider_admin_charge_response(charge)
    return charge_response(charge).model_dump(mode="json")


def invoice_response(db: Session, invoice: Invoice) -> InvoiceResponse:
    lines = db.scalars(select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id).order_by(InvoiceLine.created_at.asc())).all()
    payments = db.scalars(select(Payment).where(Payment.invoice_id == invoice.id).order_by(Payment.created_at.asc())).all()
    return InvoiceResponse(
        id=invoice.id,
        provider_code=invoice.provider_code,
        invoice_number=invoice.invoice_number,
        period_start=invoice.period_start.isoformat(),
        period_end=invoice.period_end.isoformat(),
        subtotal_amount=Decimal(str(invoice.subtotal_amount)),
        tax_amount=Decimal(str(invoice.tax_amount)),
        total_amount=Decimal(str(invoice.total_amount)),
        currency=invoice.currency,
        status=invoice.status,
        issued_at=invoice.issued_at.isoformat() if invoice.issued_at else None,
        paid_at=invoice.paid_at.isoformat() if invoice.paid_at else None,
        created_by_email=invoice.created_by_email,
        lines=[
            InvoiceLineResponse(
                id=line.id,
                charge_id=line.charge_id,
                description=line.description,
                amount=Decimal(str(line.amount)),
                currency=line.currency,
                source_event_id=line.source_event_id,
            )
            for line in lines
        ],
        payments=[
            PaymentResponse(
                id=payment.id,
                invoice_id=payment.invoice_id,
                provider_code=payment.provider_code,
                amount=Decimal(str(payment.amount)),
                currency=payment.currency,
                status=payment.status,
                mock_payment_reference=payment.mock_payment_reference,
                paid_by_email=payment.paid_by_email,
                created_at=payment.created_at.isoformat(),
            )
            for payment in payments
        ],
    )


def overview_response(
    db: Session,
    settings: Settings,
    provider_code: str | None,
    include_provider_rows: bool,
) -> BillingOverviewResponse:
    charges = db.scalars(select(ChargeRecord) if provider_code is None else select(ChargeRecord).where(ChargeRecord.provider_code == provider_code)).all()
    invoices = db.scalars(select(Invoice) if provider_code is None else select(Invoice).where(Invoice.provider_code == provider_code)).all()
    currency = next((charge.currency for charge in charges), settings.default_currency)
    unbilled_amount = sum_money(charge.amount for charge in charges if charge.status == "unbilled")
    paid_amount = sum_money(invoice.total_amount for invoice in invoices if invoice.status == "paid")
    unpaid_amount = sum_money(invoice.total_amount for invoice in invoices if invoice.status == "issued")
    effective_pricing = None
    if provider_code:
        effective_pricing = pricing_rule_response(get_effective_pricing_rule(db, provider_code, settings))
    return BillingOverviewResponse(
        provider_code=provider_code,
        unpaid_amount=unpaid_amount,
        paid_amount=paid_amount,
        unbilled_amount=unbilled_amount,
        charge_count=len(charges),
        unbilled_charge_count=sum(1 for charge in charges if charge.status == "unbilled"),
        invoiced_charge_count=sum(1 for charge in charges if charge.status == "invoiced"),
        paid_charge_count=sum(1 for charge in charges if charge.status == "paid"),
        issued_invoice_count=sum(1 for invoice in invoices if invoice.status == "issued"),
        paid_invoice_count=sum(1 for invoice in invoices if invoice.status == "paid"),
        currency=currency,
        effective_pricing=effective_pricing,
        provider_rows=provider_overview_rows(db, settings) if include_provider_rows else [],
    )


def provider_overview_rows(db: Session, settings: Settings) -> list[dict]:
    provider_codes = sorted(set(db.scalars(select(ChargeRecord.provider_code)).all()) | set(db.scalars(select(Invoice.provider_code)).all()))
    return [
        overview_response(db, settings, provider_code, include_provider_rows=False).model_dump(mode="json")
        for provider_code in provider_codes
    ]


def sum_money(values) -> Decimal:
    return sum((Decimal(str(value)) for value in values), Decimal("0.00"))
