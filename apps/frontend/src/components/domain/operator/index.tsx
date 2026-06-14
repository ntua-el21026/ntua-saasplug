import { Card, MetricCard } from "../../ui";
import { formatDateTime, formatMoney, formatNumber } from "../../../lib/formatting";
import type { OperatorCatalogHealth, PricingRule, ProviderCode } from "../../../lib/types";
import { ProviderBadge } from "../provider";
import { SyncRunStatusBadge } from "../status";

export function UsageMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return <MetricCard label={label} value={typeof value === "number" ? formatNumber(value) : value} hint={hint} />;
}

export function CatalogFreshnessIndicator({ row }: { row: OperatorCatalogHealth }) {
  return (
    <Card className="catalog-freshness-indicator">
      <ProviderBadge providerCode={row.provider_code} />
      <strong>{formatNumber(row.active_count)} active</strong>
      <span>{formatNumber(row.stale_count)} stale</span>
      <small>Latest import {formatDateTime(row.last_successful_import_at)}</small>
      <SyncRunStatusBadge status={row.last_import_status} />
    </Card>
  );
}

export function PricingRuleCard({ rule }: { rule: PricingRule }) {
  const scope: ProviderCode | "global" = rule.provider_code ?? "global";
  return (
    <Card className="pricing-rule-card">
      <div>
        <strong>{rule.name}</strong>
        <small>{scope === "global" ? "Global default" : scope}</small>
      </div>
      <span>{formatMoney(rule.reservation_success_fee, rule.currency)} reservation</span>
      <span>{rule.point_view_fee_enabled ? `${formatMoney(rule.point_view_fee, rule.currency)} point view` : "Point view disabled"}</span>
    </Card>
  );
}
