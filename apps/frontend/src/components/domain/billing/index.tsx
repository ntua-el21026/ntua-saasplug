import { Link } from "react-router-dom";

import { Card, MetricCard } from "../../ui";
import { formatDateTime, formatMoney, statusLabel } from "../../../lib/formatting";
import type { Invoice } from "../../../lib/types";
import { GenericStatusBadge } from "../status";

export function InvoiceStatusBadge({ status }: { status: string }) {
  return <GenericStatusBadge status={status} />;
}

export function InvoiceSummaryCard({
  invoice,
  detailBasePath = "/provider/invoices",
}: {
  invoice: Invoice;
  detailBasePath?: string;
}) {
  return (
    <Card className="invoice-summary-card">
      <div>
        <GenericStatusBadge status={invoice.status} />
        <h3>{invoice.invoice_number}</h3>
        <p>{statusLabel(invoice.status)} invoice issued {formatDateTime(invoice.issued_at)}</p>
      </div>
      <MetricCard label="Total" value={formatMoney(invoice.total_amount, invoice.currency)} />
      <Link className="text-link" to={`${detailBasePath}/${invoice.id}`}>
        Open invoice
      </Link>
    </Card>
  );
}
