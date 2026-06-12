from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from saasplug_events.envelope import EventEnvelope


class CurrentPrincipal(BaseModel):
    sub: str
    email: str
    roles: list[str]
    provider_id: str | None = None
    provider_code: str | None = None


class PricingRuleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_code: str | None = None
    name: str = "Pricing rule"
    active: bool = True
    currency: str = "EUR"
    reservation_success_fee: Decimal = Field(default=Decimal("0.50"), ge=0)
    point_view_fee: Decimal = Field(default=Decimal("0.01"), ge=0)
    point_view_fee_enabled: bool = True
    reservation_failure_fee: Decimal = Field(default=Decimal("0.00"), ge=0)


class PricingRulePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    active: bool | None = None
    currency: str | None = None
    reservation_success_fee: Decimal | None = Field(default=None, ge=0)
    point_view_fee: Decimal | None = Field(default=None, ge=0)
    point_view_fee_enabled: bool | None = None
    reservation_failure_fee: Decimal | None = Field(default=None, ge=0)


class PricingRuleResponse(BaseModel):
    id: str
    provider_code: str | None
    name: str
    active: bool
    currency: str
    reservation_success_fee: Decimal
    point_view_fee: Decimal
    point_view_fee_enabled: bool
    reservation_failure_fee: Decimal
    created_by_email: str | None
    created_at: str
    updated_at: str


class IngestResultResponse(BaseModel):
    event_id: str
    event_type: str
    result: Literal["charged", "skipped", "duplicate", "unsupported", "failed"]
    charge_id: str | None = None
    message: str | None = None


class IngestResponse(BaseModel):
    charged_count: int
    skipped_count: int
    duplicate_count: int
    unsupported_count: int
    failed_count: int
    results: list[IngestResultResponse]


class DrainResponse(BaseModel):
    requested_limit: int
    received_count: int
    ack_count: int
    reject_count: int
    requeue_count: int
    charged_count: int
    skipped_count: int
    duplicate_count: int
    unsupported_count: int
    failed_count: int
    invalid_count: int


class OutboxPublishResponse(BaseModel):
    selected_count: int
    published_count: int
    failed_count: int
    skipped_count: int
    published_event_ids: list[str]
    failed_event_ids: list[str]


class ChargeResponse(BaseModel):
    id: str
    source_event_id: str
    provider_code: str
    event_type: str
    charge_type: str
    amount: Decimal
    currency: str
    status: str
    reservation_id: str | None
    internal_point_id: str | None
    external_point_id: str | None
    user_id: str | None
    occurred_at: str
    pricing_rule_id: str | None
    invoice_id: str | None
    created_at: str


class InvoiceIssueRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_code: str
    period_start: datetime
    period_end: datetime
    tax_amount: Decimal = Field(default=Decimal("0.00"), ge=0)


class InvoiceLineResponse(BaseModel):
    id: str
    charge_id: str
    description: str
    amount: Decimal
    currency: str
    source_event_id: str


class PaymentResponse(BaseModel):
    id: str
    invoice_id: str
    provider_code: str
    amount: Decimal
    currency: str
    status: str
    mock_payment_reference: str
    paid_by_email: str | None
    created_at: str


class InvoiceResponse(BaseModel):
    id: str
    provider_code: str
    invoice_number: str
    period_start: str
    period_end: str
    subtotal_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    currency: str
    status: str
    issued_at: str | None
    paid_at: str | None
    created_by_email: str | None
    lines: list[InvoiceLineResponse] = Field(default_factory=list)
    payments: list[PaymentResponse] = Field(default_factory=list)


class MockPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mock_payment_reference: str | None = None


class BillingOverviewResponse(BaseModel):
    provider_code: str | None
    unpaid_amount: Decimal
    paid_amount: Decimal
    unbilled_amount: Decimal
    charge_count: int
    unbilled_charge_count: int
    invoiced_charge_count: int
    paid_charge_count: int
    issued_invoice_count: int
    paid_invoice_count: int
    currency: str
    effective_pricing: PricingRuleResponse | None = None
    provider_rows: list[dict[str, Any]] = Field(default_factory=list)


class EventIngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[EventEnvelope] = Field(min_length=1)
