from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.event_publisher import stage_outbox_event
from app.models import ChargeRecord, Invoice, InvoiceLine, Payment, utcnow
from app.pricing import money_string
from saasplug_events.routing import EventType


def issue_invoice(
    db: Session,
    provider_code: str,
    period_start: datetime,
    period_end: datetime,
    tax_amount: Decimal,
    created_by_email: str,
) -> Invoice:
    if period_end <= period_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_type": "invalid_period", "message": "period_end must be after period_start"},
        )

    charges = db.scalars(
        select(ChargeRecord)
        .where(
            ChargeRecord.provider_code == provider_code,
            ChargeRecord.status == "unbilled",
            ChargeRecord.invoice_id.is_(None),
            ChargeRecord.occurred_at >= period_start,
            ChargeRecord.occurred_at <= period_end,
        )
        .order_by(ChargeRecord.occurred_at.asc())
        .with_for_update(),
    ).all()
    if not charges:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_type": "no_unbilled_charges",
                "message": "No unbilled charges exist for the requested provider and period",
            },
        )

    currency = charges[0].currency
    if any(charge.currency != currency for charge in charges):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_type": "mixed_currencies", "message": "Cannot issue one invoice across currencies"},
        )

    subtotal = sum((Decimal(str(charge.amount)) for charge in charges), Decimal("0.00"))
    total = subtotal + tax_amount
    invoice = Invoice(
        provider_code=provider_code,
        invoice_number=next_invoice_number(db, provider_code, period_end),
        period_start=period_start,
        period_end=period_end,
        subtotal_amount=subtotal,
        tax_amount=tax_amount,
        total_amount=total,
        currency=currency,
        status="issued",
        issued_at=utcnow(),
        created_by_email=created_by_email,
    )
    db.add(invoice)
    db.flush()

    for charge in charges:
        charge.status = "invoiced"
        charge.invoice_id = invoice.id
        db.add(
            InvoiceLine(
                invoice_id=invoice.id,
                charge_id=charge.id,
                description=invoice_line_description(charge),
                amount=charge.amount,
                currency=charge.currency,
                source_event_id=charge.source_event_id,
            ),
        )

    stage_outbox_event(
        db,
        EventType.BILLING_INVOICE_ISSUED.value,
        invoice.id,
        invoice.id,
        invoice.provider_code,
        {
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "provider_code": invoice.provider_code,
            "amount": money_string(invoice.total_amount),
            "invoice_amount": money_string(invoice.total_amount),
            "total_amount": money_string(invoice.total_amount),
            "unpaid_amount": money_string(invoice.total_amount),
            "currency": invoice.currency,
            "status": invoice.status,
            "charge_count": len(charges),
        },
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_type": "invoice_charge_conflict",
                "message": "One or more selected charges were already invoiced by another request",
            },
        ) from exc
    db.refresh(invoice)
    return invoice


def pay_invoice(
    db: Session,
    invoice: Invoice,
    paid_by_email: str,
    mock_payment_reference: str | None = None,
) -> Payment:
    locked_invoice = db.scalar(select(Invoice).where(Invoice.id == invoice.id).with_for_update())
    if locked_invoice is not None:
        invoice = locked_invoice

    if invoice.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_type": "invoice_already_paid", "message": "Invoice is already paid"},
        )
    if invoice.status != "issued":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_type": "invoice_not_payable", "message": "Only issued invoices can be paid"},
        )

    existing_payment = db.scalar(
        select(Payment)
        .where(Payment.invoice_id == invoice.id, Payment.status == "succeeded")
        .limit(1),
    )
    if existing_payment is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_type": "duplicate_invoice_payment", "message": "Invoice already has a successful payment"},
        )

    reference = mock_payment_reference or f"MOCK-{invoice.invoice_number}-001"
    payment = Payment(
        invoice_id=invoice.id,
        provider_code=invoice.provider_code,
        amount=invoice.total_amount,
        currency=invoice.currency,
        status="succeeded",
        mock_payment_reference=reference,
        paid_by_email=paid_by_email,
    )
    db.add(payment)
    invoice.status = "paid"
    invoice.paid_at = utcnow()

    charge_ids = [line.charge_id for line in db.scalars(select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id)).all()]
    if charge_ids:
        for charge in db.scalars(select(ChargeRecord).where(ChargeRecord.id.in_(charge_ids))).all():
            charge.status = "paid"

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_type": "duplicate_invoice_payment", "message": "Invoice already has a successful payment"},
        ) from exc
    stage_outbox_event(
        db,
        EventType.BILLING_INVOICE_PAID.value,
        invoice.id,
        invoice.id,
        invoice.provider_code,
        {
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "payment_id": payment.id,
            "provider_code": invoice.provider_code,
            "amount": money_string(payment.amount),
            "paid_amount": money_string(payment.amount),
            "total_amount": money_string(invoice.total_amount),
            "unpaid_amount": "0.00",
            "currency": invoice.currency,
            "status": invoice.status,
            "mock_payment_reference": payment.mock_payment_reference,
        },
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_type": "duplicate_invoice_payment", "message": "Invoice already has a successful payment"},
        ) from exc
    db.refresh(payment)
    return payment


def next_invoice_number(db: Session, provider_code: str, period_end: datetime) -> str:
    prefix = f"INV-{period_end.strftime('%Y%m%d')}-{provider_code}-"
    existing_count = db.scalar(select(func.count(Invoice.id)).where(Invoice.invoice_number.like(f"{prefix}%"))) or 0
    return f"{prefix}{existing_count + 1:04d}"


def invoice_line_description(charge: ChargeRecord) -> str:
    if charge.charge_type == "reservation_success":
        return f"Successful reservation fee for {charge.provider_code}"
    if charge.charge_type == "point_view":
        return f"Point view fee for {charge.provider_code}"
    if charge.charge_type == "reservation_failure":
        return f"Reservation failure fee for {charge.provider_code}"
    return f"Billing charge for {charge.provider_code}"
