import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { AppShell } from "../../components/AppShell";
import { InvoiceStatusBadge } from "../../components/domain/billing";
import { ProviderHealthBadge } from "../../components/domain/provider";
import { SyncRunStatusBadge } from "../../components/domain/status";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../auth/AuthContext";
import { messageFromUnknownError, requestJson, requestText } from "../../lib/api";
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  providerLabel,
  PROVIDERS,
  statusLabel,
} from "../../lib/formatting";
import type {
  AggregateRefreshResponse,
  BillingOverview,
  CatalogImportAllResponse,
  CatalogImportRun,
  CatalogImportSummary,
  CatalogPointListResponse,
  Charge,
  Invoice,
  OperatorProviderComparison,
  OperatorSummary,
  PricingRule,
  ProviderAuditLog,
  ProviderCode,
  ProviderDailyTrend,
  ProviderFreshness,
  ProviderIntegrationConfig,
  ProviderRecord,
  ProviderSummary,
  QueueDrainResponse,
  SchedulerHealth,
  SchedulerJob,
  SchedulerRun,
  SchedulerSequenceRun,
  StatusProviderFreshness,
} from "../../lib/types";
import {
  BarList,
  DashboardGrid,
  DashboardPage,
  DashboardPanel,
  DataTable,
  InlineResult,
  LoadState,
  MetricCard,
  MetricGrid,
} from "./AdminUi";

type AsyncState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

const DEFAULT_LIMIT = 100;

function useDashboardLoad<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, error: null, loading: true }));

    load()
      .then((data) => {
        if (active) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((caught) => {
        if (active) {
          setState({ data: null, error: messageFromUnknownError(caught), loading: false });
        }
      });

    return () => {
      active = false;
    };
  }, deps);

  return state;
}

function useAccessToken(): string {
  const { session } = useAuth();
  return session?.accessToken ?? "";
}

function useProviderCode(): ProviderCode | null {
  const { session } = useAuth();
  return (session?.user.provider_code as ProviderCode | null) ?? null;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function dateToUtcStart(value: string): string {
  return `${value}T00:00:00Z`;
}

function dateToUtcEnd(value: string): string {
  return `${value}T23:59:59Z`;
}

function providerQuery(providerCode: ProviderCode | null): string {
  return providerCode ? `?providerCode=${encodeURIComponent(providerCode)}` : "";
}

function effectiveCurrency(overview: BillingOverview | null, fallback: string | null | undefined = "EUR"): string {
  return overview?.currency || overview?.effective_pricing?.currency || fallback || "EUR";
}

function formatSchedule(job: SchedulerJob): string {
  if (job.schedule_type === "manual") {
    return "Manual";
  }
  if (job.schedule_type === "interval" && job.interval_seconds !== null) {
    return formatDurationSeconds(job.interval_seconds);
  }
  return job.cron_expression ?? "Not scheduled";
}

function formatDurationSeconds(totalSeconds: number): string {
  if (totalSeconds % 86400 === 0) {
    const days = totalSeconds / 86400;
    return days === 1 ? "Every day" : `Every ${days} days`;
  }
  if (totalSeconds % 3600 === 0) {
    const hours = totalSeconds / 3600;
    return hours === 1 ? "Every hour" : `Every ${hours} hours`;
  }
  if (totalSeconds % 60 === 0) {
    const minutes = totalSeconds / 60;
    return minutes === 1 ? "Every minute" : `Every ${minutes} minutes`;
  }
  return `Every ${totalSeconds} seconds`;
}

function HealthPill({ ok, label }: { ok: boolean; label: string }) {
  return <ProviderHealthBadge ok={ok} label={label} />;
}

function InvoiceStatus({ status }: { status: string }) {
  return <InvoiceStatusBadge status={status} />;
}

function changedFieldSummary(changedFields: ProviderAuditLog["changed_fields"] | null | undefined): string {
  if (Array.isArray(changedFields)) {
    return changedFields.join(", ") || "None";
  }
  if (changedFields && typeof changedFields === "object") {
    return Object.keys(changedFields).join(", ") || "None";
  }
  return "None";
}

function SchedulerScheduleEditor({
  accessToken,
  job,
  onSaved,
  onMessage,
}: {
  accessToken: string;
  job: SchedulerJob;
  onSaved: () => void;
  onMessage: (message: string) => void;
}) {
  const initialValue = job.schedule_type === "interval"
    ? String(job.interval_seconds ?? "")
    : job.cron_expression ?? "";
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (job.schedule_type === "manual") {
    return <span>{formatSchedule(job)}</span>;
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const body = job.schedule_type === "interval"
        ? { interval_seconds: Number(value) }
        : { cron_expression: value.trim() };
      await requestJson<SchedulerJob>(
        `/api/scheduler/jobs/${encodeURIComponent(job.job_key)}`,
        { method: "PATCH", accessToken, bodyJson: body },
      );
      onMessage(`${job.job_key} schedule updated.`);
      onSaved();
    } catch (caught) {
      onMessage(messageFromUnknownError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="scheduler-schedule-form" onSubmit={saveSchedule}>
      <label>
        <span className="sr-only">{job.schedule_type === "interval" ? "Interval seconds" : "Cron expression"}</span>
        <input
          aria-label={`${job.job_key} ${job.schedule_type === "interval" ? "interval seconds" : "cron expression"}`}
          min={job.schedule_type === "interval" ? 30 : undefined}
          step={job.schedule_type === "interval" ? 60 : undefined}
          type={job.schedule_type === "interval" ? "number" : "text"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <span className="muted">{formatSchedule(job)}</span>
      <button className="button-secondary" type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

function requireProvider(providerCode: ProviderCode | null) {
  if (!providerCode) {
    throw new Error("This provider admin account is not scoped to a provider.");
  }
  return providerCode;
}

function scopeCatalogToProvider(catalog: CatalogPointListResponse, providerCode: ProviderCode): CatalogPointListResponse {
  const items = catalog.items.filter((point) => point.provider_code === providerCode);
  return { ...catalog, items, total: items.length };
}

function scopeStatusFreshnessToProvider(rows: StatusProviderFreshness[], providerCode: ProviderCode): StatusProviderFreshness[] {
  return rows.filter((row) => row.provider_code === providerCode);
}

async function loadProviderSummary(accessToken: string, providerCode: ProviderCode) {
  const query = `providerCode=${encodeURIComponent(providerCode)}`;
  const [summary, trends, topPoints, invoices, billing, catalog, freshness] = await Promise.all([
    requestJson<ProviderSummary>(`/api/analytics/provider/summary?${query}`, { accessToken }),
    requestJson<ProviderDailyTrend[]>(`/api/analytics/provider/trends/daily?${query}`, { accessToken }),
    requestJson<ProviderSummary>(`/api/analytics/provider/summary?${query}`, { accessToken }),
    requestJson<Invoice[]>(`/api/billing/invoices?${query}`, { accessToken }),
    requestJson<BillingOverview>(`/api/billing/providers/${providerCode}/overview`, { accessToken }),
    requestJson<CatalogPointListResponse>(`/api/catalog/points?providerCode=${providerCode}&includeStale=true&limit=25`, { accessToken }),
    requestJson<ProviderFreshness[]>("/api/catalog/freshness", { accessToken }),
  ]);
  return { summary, trends, topPoints, invoices, billing, catalog: scopeCatalogToProvider(catalog, providerCode), freshness };
}

export function ProviderDashboardPage() {
  const accessToken = useAccessToken();
  const providerCode = useProviderCode();
  const state = useDashboardLoad(
    () => loadProviderSummary(accessToken, requireProvider(providerCode)),
    [accessToken, providerCode],
  );
  const data = state.data;
  const currency = effectiveCurrency(data?.billing ?? null, data?.summary.currency);
  const providerFreshness = data?.freshness.find((row) => row.provider_code === providerCode) ?? null;

  return (
    <AppShell>
      <DashboardPage
        title="Provider command center"
        description="Track your charging network, reservation performance, billing status, and recent catalog updates."
      >
        <LoadState loading={state.loading} error={state.error} />
        {data ? (
          <>
            <MetricGrid>
              <MetricCard label="Point views" value={formatNumber(data.summary.total_point_views)} />
              <MetricCard label="Successful reservations" value={formatNumber(data.summary.successful_reservations)} />
              <MetricCard label="Conversion" value={formatPercent(data.summary.reservation_conversion_rate)} />
              <MetricCard label="Unpaid invoices" value={formatMoney(data.billing.unpaid_amount, currency)} />
            </MetricGrid>
            <DashboardGrid>
              <DashboardPanel title="Usage trend" description="Daily successful reservations across your charging network.">
                <BarList
                  rows={data.trends}
                  getLabel={(row) => new Date(row.day_bucket).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  getValue={(row) => row.successful_reservations}
                />
              </DashboardPanel>
              <DashboardPanel title="Catalog posture" description="Current coverage and update status for your listed charging points.">
                <dl className="admin-definition-list">
                  <div>
                    <dt>Active points</dt>
                    <dd>{formatNumber(providerFreshness?.active_count)}</dd>
                  </div>
                  <div>
                    <dt>Stale points</dt>
                    <dd>{formatNumber(providerFreshness?.stale_count)}</dd>
                  </div>
                  <div>
                    <dt>Latest import</dt>
                    <dd>{formatDateTime(providerFreshness?.last_successful_import_at)}</dd>
                  </div>
                  <div>
                    <dt>Billing pricing</dt>
                    <dd>{data.billing.effective_pricing?.name ?? "Default pricing not available"}</dd>
                  </div>
                </dl>
              </DashboardPanel>
              <DashboardPanel title="Top viewed points" description="Charging points attracting the most driver interest.">
                <BarList
                  rows={data.summary.top_viewed_points}
                  getLabel={(row) => row.point_name || row.external_point_id || "Unknown point"}
                  getValue={(row) => row.point_views}
                />
              </DashboardPanel>
              <DashboardPanel title="Recent invoices" description="Latest invoices and payment status for your provider account.">
                <InvoiceTable invoices={data.invoices.slice(0, 6)} showProvider={false} />
              </DashboardPanel>
            </DashboardGrid>
          </>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function ProviderPointsPage() {
  const accessToken = useAccessToken();
  const providerCode = useProviderCode();
  const [query, setQuery] = useState("");
  const [includeStale, setIncludeStale] = useState(true);
  const state = useDashboardLoad(async () => {
    const code = requireProvider(providerCode);
    const params = new URLSearchParams({
      providerCode: code,
      includeStale: String(includeStale),
      limit: String(DEFAULT_LIMIT),
    });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const [catalog, statusFreshness] = await Promise.all([
      requestJson<CatalogPointListResponse>(`/api/catalog/points?${params.toString()}`, { accessToken }),
      requestJson<StatusProviderFreshness[]>("/api/status/freshness", { accessToken }),
    ]);
    return {
      catalog: scopeCatalogToProvider(catalog, code),
      statusFreshness: scopeStatusFreshnessToProvider(statusFreshness, code),
    };
  }, [accessToken, providerCode, query, includeStale]);

  return (
    <AppShell>
      <DashboardPage
        title="Provider points"
        description="Review your charging-point inventory, availability state, and latest catalog updates."
      >
        <section className="admin-toolbar">
          <label>
            Search points
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, address, external ID" />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={includeStale} onChange={(event) => setIncludeStale(event.target.checked)} />
            Include stale points
          </label>
        </section>
        <LoadState loading={state.loading} error={state.error} />
        {state.data ? (
          <DashboardGrid>
            <DashboardPanel title="Point inventory" description={`${state.data.catalog.total} charging points match the current filter.`}>
              <DataTable
                rows={state.data.catalog.items}
                getRowKey={(row) => row.id}
                columns={[
                  { key: "name", label: "Point", render: (row) => <Link className="text-link" to={`/points/${row.provider_code}/${row.external_point_id}`}>{row.display_name}</Link> },
                  { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
                  { key: "connector", label: "Connector", render: (row) => row.connector ?? "Unknown" },
                  { key: "stale", label: "Freshness", render: (row) => (row.is_stale ? "Stale" : "Fresh") },
                  { key: "synced", label: "Updated", render: (row) => formatDateTime(row.last_catalog_sync_at) },
                ]}
              />
            </DashboardPanel>
            <DashboardPanel title="Availability checks" description="Recent availability coverage for your provider points.">
              <DataTable
                rows={state.data.statusFreshness}
                getRowKey={(row) => row.provider_code}
                columns={[
                  { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                  { key: "cached", label: "Known points", render: (row) => formatNumber(row.cached_count) },
                  { key: "valid", label: "Current", render: (row) => formatNumber(row.valid_cache_count) },
                  { key: "expired", label: "Needs refresh", render: (row) => formatNumber(row.expired_cache_count) },
                  { key: "checked", label: "Last checked", render: (row) => formatDateTime(row.last_checked_at) },
                ]}
              />
            </DashboardPanel>
          </DashboardGrid>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function ProviderAnalyticsPage() {
  const accessToken = useAccessToken();
  const providerCode = useProviderCode();
  const state = useDashboardLoad(async () => {
    const code = requireProvider(providerCode);
    const query = `providerCode=${encodeURIComponent(code)}`;
    const [summary, trends, topViews, topReservations, freshness] = await Promise.all([
      requestJson<ProviderSummary>(`/api/analytics/provider/summary?${query}`, { accessToken }),
      requestJson<ProviderDailyTrend[]>(`/api/analytics/provider/trends/daily?${query}`, { accessToken }),
      requestJson<ProviderSummary>(`/api/analytics/provider/summary?${query}`, { accessToken }),
      requestJson<ProviderSummary>(`/api/analytics/provider/summary?${query}`, { accessToken }),
      requestJson(`/api/analytics/provider/freshness?${query}`, { accessToken }),
    ]);
    return { summary, trends, topViews, topReservations, freshness };
  }, [accessToken, providerCode]);
  const summary = state.data?.summary ?? null;
  const currency = summary?.currency ?? "EUR";
  const statusDistribution = summary?.status_distribution ?? {};

  return (
    <AppShell>
      <DashboardPage
        title="Provider analytics"
        description="Review demand, reservations, status checks, and revenue signals for your charging network."
      >
        <LoadState loading={state.loading} error={state.error} />
        {summary ? (
          <>
            <MetricGrid>
              <MetricCard label="Searches" value={formatNumber(summary.total_searches)} />
              <MetricCard label="Status checks" value={formatNumber(summary.total_status_checks)} />
              <MetricCard label="Failed reservations" value={formatNumber(summary.failed_reservations)} />
              <MetricCard label="Observed amount" value={formatMoney(summary.observed_amount, currency)} />
            </MetricGrid>
            <DashboardGrid>
              <DashboardPanel title="Reservation trend" description="Successful reservations per day.">
                <BarList
                  rows={state.data?.trends ?? []}
                  getLabel={(row) => new Date(row.day_bucket).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  getValue={(row) => row.successful_reservations}
                />
              </DashboardPanel>
              <DashboardPanel title="Status distribution" description="Latest availability mix across observed charging points.">
                <BarList
                  rows={Object.entries(statusDistribution)}
                  getLabel={(row) => statusLabel(row[0])}
                  getValue={(row) => row[1]}
                />
              </DashboardPanel>
              <DashboardPanel title="Top viewed points" description="Point-view leaders.">
                <TopPointTable rows={summary.top_viewed_points} valueLabel="Views" valueSelector={(row) => row.point_views} />
              </DashboardPanel>
              <DashboardPanel title="Top reserved points" description="Reservation leaders.">
                <TopPointTable rows={summary.top_reserved_points} valueLabel="Reservations" valueSelector={(row) => row.successful_reservations} />
              </DashboardPanel>
            </DashboardGrid>
          </>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function ProviderInvoicesPage() {
  const accessToken = useAccessToken();
  const providerCode = useProviderCode();
  const state = useDashboardLoad(async () => {
    const query = providerQuery(requireProvider(providerCode));
    const [invoices, overview] = await Promise.all([
      requestJson<Invoice[]>(`/api/billing/invoices${query}`, { accessToken }),
      requestJson<BillingOverview>(`/api/billing/providers/${providerCode}/overview`, { accessToken }),
    ]);
    return { invoices, overview };
  }, [accessToken, providerCode]);
  const currency = effectiveCurrency(state.data?.overview ?? null);

  return (
    <AppShell>
      <DashboardPage
        title="Provider invoices"
        description="View issued invoices, record payments, and monitor outstanding balances."
      >
        <LoadState loading={state.loading} error={state.error} />
        {state.data ? (
          <>
            <MetricGrid>
              <MetricCard label="Unpaid" value={formatMoney(state.data.overview.unpaid_amount, currency)} />
              <MetricCard label="Paid" value={formatMoney(state.data.overview.paid_amount, currency)} />
              <MetricCard label="Unbilled" value={formatMoney(state.data.overview.unbilled_amount, currency)} />
              <MetricCard label="Issued invoices" value={formatNumber(state.data.overview.issued_invoice_count)} />
            </MetricGrid>
            <DashboardPanel title="Invoices" description="Open an invoice to inspect charges and record a full payment.">
              <InvoiceTable invoices={state.data.invoices} showProvider={false} />
            </DashboardPanel>
          </>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function ProviderInvoiceDetailPage() {
  const accessToken = useAccessToken();
  const { invoiceId } = useParams();
  const [paymentReference, setPaymentReference] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const state = useDashboardLoad(
    () => requestJson<Invoice>(`/api/billing/invoices/${invoiceId}`, { accessToken }),
    [accessToken, invoiceId, reloadKey],
  );

  async function payInvoice(event: FormEvent) {
    event.preventDefault();
    if (!invoiceId) {
      return;
    }
    setActionMessage(null);
    try {
      await requestJson<Invoice>(`/api/billing/invoices/${invoiceId}/pay`, {
        method: "POST",
        accessToken,
        bodyJson: { mock_payment_reference: paymentReference || null },
      });
      setActionMessage("Payment recorded for this invoice.");
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setActionMessage(messageFromUnknownError(caught));
    }
  }

  const invoice = state.data;

  return (
    <AppShell>
      <DashboardPage
        title={invoice ? invoice.invoice_number : "Invoice detail"}
        description="Inspect invoice charges and record a full payment when the invoice is issued."
      >
        <LoadState loading={state.loading} error={state.error} />
        {invoice ? (
          <DashboardGrid>
            <DashboardPanel title="Invoice summary" description={`Period ${formatDateTime(invoice.period_start)} to ${formatDateTime(invoice.period_end)}.`}>
              <dl className="admin-definition-list">
                <div>
                  <dt>Status</dt>
                  <dd><InvoiceStatus status={invoice.status} /></dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{formatMoney(invoice.total_amount, invoice.currency)}</dd>
                </div>
                <div>
                  <dt>Issued</dt>
                  <dd>{formatDateTime(invoice.issued_at)}</dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{formatDateTime(invoice.paid_at)}</dd>
                </div>
              </dl>
              {invoice.status === "issued" ? (
                <form className="admin-inline-form" onSubmit={payInvoice}>
                  <label>
                    Payment reference
                    <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Optional reference" />
                  </label>
                  <button className="button-primary" type="submit">Pay invoice</button>
                </form>
              ) : null}
              <InlineResult message={actionMessage} tone={actionMessage?.includes("paid") ? "success" : "warning"} />
            </DashboardPanel>
            <DashboardPanel title="Invoice lines" description="Charges included in this invoice.">
              <DataTable
                rows={invoice.lines}
                getRowKey={(row) => row.id}
                columns={[
                  { key: "description", label: "Description", render: (row) => row.description },
                  { key: "event", label: "Reference", render: (row) => row.source_event_id },
                  { key: "amount", label: "Amount", render: (row) => formatMoney(row.amount, row.currency) },
                ]}
              />
            </DashboardPanel>
          </DashboardGrid>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function ProviderExportPage() {
  const accessToken = useAccessToken();
  const providerCode = useProviderCode();
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayDate());
  const [message, setMessage] = useState<string | null>(null);

  async function exportUsage(event: FormEvent) {
    event.preventDefault();
    const code = requireProvider(providerCode);
    setMessage(null);
    try {
      const params = new URLSearchParams({ providerCode: code, from: fromDate, to: toDate });
      const csv = await requestText(`/api/analytics/exports/usage.csv?${params.toString()}`, {
        accessToken,
        headers: { Accept: "text/csv" },
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${code}-usage-${fromDate}-${toDate}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("Usage CSV export downloaded.");
    } catch (caught) {
      setMessage(messageFromUnknownError(caught));
    }
  }

  return (
    <AppShell>
      <DashboardPage
        title="Usage export"
        description="Download a CSV report of your provider activity for the selected period."
      >
        <DashboardPanel title="CSV export" description="Exports are scoped to your provider account.">
          <form className="admin-form" onSubmit={exportUsage}>
            <label>
              From
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <button className="button-primary" type="submit">Download CSV</button>
          </form>
          <InlineResult message={message} tone={message?.includes("downloaded") ? "success" : "warning"} />
        </DashboardPanel>
      </DashboardPage>
    </AppShell>
  );
}

export function ProviderSettingsPage() {
  const accessToken = useAccessToken();
  const providerCode = useProviderCode();
  const state = useDashboardLoad(async () => {
    const code = requireProvider(providerCode);
    const [provider, config, pricing, auditLogs] = await Promise.all([
      requestJson<ProviderRecord>(`/api/providers/providers/${code}`, { accessToken }),
      requestJson<ProviderIntegrationConfig>(`/api/providers/providers/${code}/integration-config`, { accessToken }),
      requestJson<PricingRule>(`/api/billing/pricing/effective/${code}`, { accessToken }),
      requestJson<ProviderAuditLog[]>(`/api/providers/providers/${code}/audit-logs`, { accessToken }),
    ]);
    return { provider, config, pricing, auditLogs };
  }, [accessToken, providerCode]);

  return (
    <AppShell>
      <DashboardPage
        title="Provider settings"
        description="Review your provider profile, connection settings, pricing, and recent account changes."
      >
        <LoadState loading={state.loading} error={state.error} />
        {state.data ? (
          <DashboardGrid>
            <DashboardPanel title="Provider profile" description="Business details used to identify your provider workspace.">
              <dl className="admin-definition-list">
                <div>
                  <dt>Provider</dt>
                  <dd>{state.data.provider.display_name}</dd>
                </div>
                <div>
                  <dt>Legal name</dt>
                  <dd>{state.data.provider.legal_name}</dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>{state.data.provider.contact_email}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{state.data.provider.is_active ? "Active" : "Inactive"}</dd>
                </div>
              </dl>
            </DashboardPanel>
            <DashboardPanel title="Connection settings" description="Configuration used to connect your provider account to saasPlug.">
              <dl className="admin-definition-list">
                <div>
                  <dt>Base URL</dt>
                  <dd>{state.data.config.api_base_url}</dd>
                </div>
                <div>
                  <dt>Auth type</dt>
                  <dd>{state.data.config.api_auth_type}</dd>
                </div>
                <div>
                  <dt>Header</dt>
                  <dd>{state.data.config.api_auth_header ?? "Not configured"}</dd>
                </div>
                <div>
                  <dt>Secret configured</dt>
                  <dd>{state.data.config.secret_configured_elsewhere ? "Yes" : "No"}</dd>
                </div>
              </dl>
            </DashboardPanel>
            <DashboardPanel title="Effective pricing" description="Pricing currently applied to activity from your provider account.">
              <dl className="admin-definition-list">
                <div>
                  <dt>Rule</dt>
                  <dd>{state.data.pricing.name}</dd>
                </div>
                <div>
                  <dt>Reservation fee</dt>
                  <dd>{formatMoney(state.data.pricing.reservation_success_fee, state.data.pricing.currency)}</dd>
                </div>
                <div>
                  <dt>Point view fee</dt>
                  <dd>{state.data.pricing.point_view_fee_enabled ? formatMoney(state.data.pricing.point_view_fee, state.data.pricing.currency) : "Disabled"}</dd>
                </div>
                <div>
                  <dt>Active</dt>
                  <dd>{state.data.pricing.active ? "Yes" : "No"}</dd>
                </div>
              </dl>
            </DashboardPanel>
            <DashboardPanel title="Recent account changes" description="Recent updates made to your provider profile and configuration.">
              <DataTable
                rows={state.data.auditLogs.slice(0, 8)}
                getRowKey={(row) => row.id}
                columns={[
                  { key: "action", label: "Action", render: (row) => row.action },
                  { key: "actor", label: "Actor", render: (row) => row.actor_email ?? "System" },
                  { key: "fields", label: "Fields", render: (row) => changedFieldSummary(row.changed_fields) },
                  { key: "created", label: "Created", render: (row) => formatDateTime(row.created_at) },
                ]}
              />
            </DashboardPanel>
          </DashboardGrid>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function OperatorDashboardPage() {
  const accessToken = useAccessToken();
  const state = useDashboardLoad(async () => {
    const [summary, billing, providers, imports] = await Promise.all([
      requestJson<OperatorSummary>("/api/analytics/operator/summary", { accessToken }),
      requestJson<BillingOverview>("/api/billing/overview", { accessToken }),
      requestJson<ProviderRecord[]>("/api/providers/providers", { accessToken }),
      requestJson<CatalogImportRun[]>("/api/catalog/imports/runs?limit=8", { accessToken }),
    ]);
    return { summary, billing, providers, imports };
  }, [accessToken]);
  const data = state.data;
  const currency = effectiveCurrency(data?.billing ?? null);

  return (
    <AppShell>
      <DashboardPage
        title="Operator command center"
        description="Global SaaS overview across providers, catalog imports, analytics freshness, and billing posture."
      >
        <LoadState loading={state.loading} error={state.error} />
        {data ? (
          <>
            <MetricGrid>
              <MetricCard label="Providers" value={`${data.summary.active_providers_seen}/${data.providers.length}`} hint="active / configured" />
              <MetricCard label="Successful reservations" value={formatNumber(data.summary.successful_reservations)} />
              <MetricCard label="Global conversion" value={formatPercent(data.summary.global_conversion_rate)} />
              <MetricCard label="Unpaid amount" value={formatMoney(data.billing.unpaid_amount, currency)} />
            </MetricGrid>
            <DashboardGrid>
              <DashboardPanel title="Provider comparison" description="Reservation conversion by provider.">
                <BarList
                  rows={data.summary.provider_comparison}
                  getLabel={(row) => providerLabel(row.provider_code)}
                  getValue={(row) => row.successful_reservations}
                />
              </DashboardPanel>
              <DashboardPanel title="Catalog health" description="Active and stale catalog records by provider.">
                <DataTable
                  rows={data.summary.catalog_health}
                  getRowKey={(row) => row.provider_code}
                  columns={[
                    { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                    { key: "active", label: "Active", render: (row) => formatNumber(row.active_count) },
                    { key: "stale", label: "Stale", render: (row) => formatNumber(row.stale_count) },
                    { key: "import", label: "Last import", render: (row) => formatDateTime(row.last_successful_import_at) },
                  ]}
                />
              </DashboardPanel>
              <DashboardPanel title="Recent import runs" description="Latest catalog refresh attempts across providers.">
                <ImportRunTable rows={data.imports} />
              </DashboardPanel>
              <DashboardPanel title="Billing by provider" description="Outstanding and billed amounts by provider.">
                <DataTable
                  rows={data.billing.provider_rows}
                  getRowKey={(row) => row.provider_code}
                  columns={[
                    { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                    { key: "unpaid", label: "Unpaid", render: (row) => formatMoney(row.unpaid_amount, currency) },
                    { key: "unbilled", label: "Unbilled", render: (row) => formatMoney(row.unbilled_amount, currency) },
                    { key: "issued", label: "Issued", render: (row) => formatNumber(row.issued_invoice_count) },
                  ]}
                />
              </DashboardPanel>
            </DashboardGrid>
          </>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function OperatorProvidersPage() {
  const accessToken = useAccessToken();
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const state = useDashboardLoad(
    () => requestJson<ProviderRecord[]>("/api/providers/providers", { accessToken }),
    [accessToken, reloadKey],
  );

  async function toggleProvider(provider: ProviderRecord) {
    setMessage(null);
    try {
      await requestJson<ProviderRecord>(`/api/providers/providers/${provider.provider_code}/status`, {
        method: "PATCH",
        accessToken,
        bodyJson: { is_active: !provider.is_active },
      });
      setMessage(`${provider.provider_code} marked ${provider.is_active ? "inactive" : "active"}.`);
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setMessage(messageFromUnknownError(caught));
    }
  }

  return (
    <AppShell>
      <DashboardPage
        title="Provider management"
        description="Review configured providers and control whether each provider is active."
      >
        <LoadState loading={state.loading} error={state.error} />
        <InlineResult message={message} tone={message?.includes("marked") ? "success" : "warning"} />
        {state.data ? (
          <DashboardPanel title="Configured providers" description="Provider identity, contact details, connection mode, and activation state.">
            <DataTable
              rows={state.data}
              getRowKey={(row) => row.id}
              columns={[
                { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                { key: "name", label: "Display name", render: (row) => row.display_name },
                { key: "email", label: "Contact", render: (row) => row.contact_email },
                { key: "auth", label: "Auth", render: (row) => row.api_auth_type },
                { key: "status", label: "Status", render: (row) => (row.is_active ? "Active" : "Inactive") },
                {
                  key: "action",
                  label: "Action",
                  render: (row) => (
                    <button className="button-secondary" type="button" onClick={() => toggleProvider(row)}>
                      {row.is_active ? "Disable" : "Enable"}
                    </button>
                  ),
                },
              ]}
            />
          </DashboardPanel>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function OperatorAnalyticsPage() {
  const accessToken = useAccessToken();
  const state = useDashboardLoad(async () => {
    const [summary, comparison, trends, freshness] = await Promise.all([
      requestJson<OperatorSummary>("/api/analytics/operator/summary", { accessToken }),
      requestJson<OperatorProviderComparison[]>("/api/analytics/operator/provider-comparison", { accessToken }),
      requestJson<ProviderDailyTrend[]>("/api/analytics/operator/trends/daily", { accessToken }),
      requestJson("/api/analytics/operator/freshness", { accessToken }),
    ]);
    return { summary, comparison, trends, freshness };
  }, [accessToken]);
  const summary = state.data?.summary ?? null;

  return (
    <AppShell>
      <DashboardPage
        title="Operator analytics"
        description="Review platform-wide demand, usage, and provider performance."
      >
        <LoadState loading={state.loading} error={state.error} />
        {summary ? (
          <>
            <MetricGrid>
              <MetricCard label="Searches" value={formatNumber(summary.total_searches)} />
              <MetricCard label="Point views" value={formatNumber(summary.total_point_views)} />
              <MetricCard label="Status checks" value={formatNumber(summary.total_status_checks)} />
              <MetricCard label="Failures" value={formatNumber(summary.failed_reservations)} />
            </MetricGrid>
            <DashboardGrid>
              <DashboardPanel title="Provider reservations" description="Successful reservations by provider.">
                <BarList
                  rows={state.data?.comparison ?? []}
                  getLabel={(row) => providerLabel(row.provider_code)}
                  getValue={(row) => row.successful_reservations}
                />
              </DashboardPanel>
              <DashboardPanel title="Daily activity" description="Daily successful reservations across the platform.">
                <BarList
                  rows={state.data?.trends ?? []}
                  getLabel={(row) => new Date(row.day_bucket).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  getValue={(row) => row.successful_reservations}
                />
              </DashboardPanel>
              <DashboardPanel title="Provider comparison" description="Global metrics by provider.">
                <DataTable
                  rows={state.data?.comparison ?? []}
                  getRowKey={(row) => row.provider_code}
                  columns={[
                    { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                    { key: "views", label: "Views", render: (row) => formatNumber(row.total_point_views) },
                    { key: "status", label: "Status checks", render: (row) => formatNumber(row.total_status_checks) },
                    { key: "conversion", label: "Conversion", render: (row) => formatPercent(row.reservation_conversion_rate) },
                    { key: "amount", label: "Observed", render: (row) => formatMoney(row.observed_amount) },
                  ]}
                />
              </DashboardPanel>
            </DashboardGrid>
          </>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function OperatorCatalogPage() {
  const accessToken = useAccessToken();
  const [providerCode, setProviderCode] = useState<"" | ProviderCode>("");
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const state = useDashboardLoad(async () => {
    const params = new URLSearchParams({ includeStale: "true", limit: "75" });
    if (providerCode) {
      params.set("providerCode", providerCode);
    }
    const [catalog, freshness, runs] = await Promise.all([
      requestJson<CatalogPointListResponse>(`/api/catalog/points?${params.toString()}`, { accessToken }),
      requestJson<ProviderFreshness[]>("/api/catalog/freshness", { accessToken }),
      requestJson<CatalogImportRun[]>("/api/catalog/imports/runs?limit=20", { accessToken }),
    ]);
    return { catalog, freshness, runs };
  }, [accessToken, providerCode, reloadKey]);

  async function triggerImport(allProviders: boolean) {
    setMessage(null);
    try {
      if (allProviders) {
        const response = await requestJson<CatalogImportAllResponse>("/api/catalog/imports/all", {
          method: "POST",
          accessToken,
        });
        setMessage(`Started catalog import for ${response.providers.length} providers.`);
      } else if (providerCode) {
        const response = await requestJson<CatalogImportSummary>(`/api/catalog/imports/providers/${providerCode}`, {
          method: "POST",
          accessToken,
        });
        setMessage(`Started ${response.provider_code} import run ${response.run_id}.`);
      }
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setMessage(messageFromUnknownError(caught));
    }
  }

  return (
    <AppShell>
      <DashboardPage
        title="Catalog and sync controls"
        description="Review catalog coverage, freshness, and provider import activity."
      >
        <section className="admin-toolbar">
          <label>
            Provider
            <select value={providerCode} onChange={(event) => setProviderCode(event.target.value as "" | ProviderCode)}>
              <option value="">All providers</option>
              {PROVIDERS.map((provider) => (
                <option value={provider} key={provider}>{providerLabel(provider)}</option>
              ))}
            </select>
          </label>
          <button className="button-secondary" type="button" onClick={() => triggerImport(true)}>Import all</button>
          <button className="button-primary" type="button" disabled={!providerCode} onClick={() => triggerImport(false)}>Import selected</button>
        </section>
        <InlineResult message={message} tone={message?.includes("Started") ? "success" : "warning"} />
        <LoadState loading={state.loading} error={state.error} />
        {state.data ? (
          <DashboardGrid>
            <DashboardPanel title="Catalog points" description={`${state.data.catalog.total} charging points match the current filter.`}>
              <DataTable
                rows={state.data.catalog.items}
                getRowKey={(row) => row.id}
                columns={[
                  { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                  { key: "point", label: "Point", render: (row) => row.display_name },
                  { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
                  { key: "stale", label: "Stale", render: (row) => (row.is_stale ? "Yes" : "No") },
                  { key: "synced", label: "Updated", render: (row) => formatDateTime(row.last_catalog_sync_at) },
                ]}
              />
            </DashboardPanel>
            <DashboardPanel title="Freshness" description="Active and stale charging points by provider.">
              <DataTable
                rows={state.data.freshness}
                getRowKey={(row) => row.provider_code}
                columns={[
                  { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                  { key: "active", label: "Active", render: (row) => formatNumber(row.active_count) },
                  { key: "stale", label: "Stale", render: (row) => formatNumber(row.stale_count) },
                  { key: "status", label: "Last status", render: (row) => row.last_import_status ?? "Unknown" },
                ]}
              />
            </DashboardPanel>
            <DashboardPanel title="Import runs" description="Recent provider import runs.">
              <ImportRunTable rows={state.data.runs} />
            </DashboardPanel>
          </DashboardGrid>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function OperatorInvoicesPage() {
  const accessToken = useAccessToken();
  const [providerCode, setProviderCode] = useState<"" | ProviderCode>("");
  const state = useDashboardLoad(async () => {
    const params = new URLSearchParams();
    if (providerCode) {
      params.set("providerCode", providerCode);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const [invoices, overview] = await Promise.all([
      requestJson<Invoice[]>(`/api/billing/invoices${suffix}`, { accessToken }),
      requestJson<BillingOverview>("/api/billing/overview", { accessToken }),
    ]);
    return { invoices, overview };
  }, [accessToken, providerCode]);
  const currency = effectiveCurrency(state.data?.overview ?? null);

  return (
    <AppShell>
      <DashboardPage
        title="Operator invoices"
        description="Monitor issued invoices and provider billing exposure."
      >
        <section className="admin-toolbar">
          <label>
            Provider
            <select value={providerCode} onChange={(event) => setProviderCode(event.target.value as "" | ProviderCode)}>
              <option value="">All providers</option>
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{providerLabel(provider)}</option>
              ))}
            </select>
          </label>
          <Link className="button-primary button-link" to="/operator/invoices/new">Issue invoice</Link>
        </section>
        <LoadState loading={state.loading} error={state.error} />
        {state.data ? (
          <>
            <MetricGrid>
              <MetricCard label="Unpaid" value={formatMoney(state.data.overview.unpaid_amount, currency)} />
              <MetricCard label="Paid" value={formatMoney(state.data.overview.paid_amount, currency)} />
              <MetricCard label="Unbilled" value={formatMoney(state.data.overview.unbilled_amount, currency)} />
              <MetricCard label="Invoice count" value={formatNumber(state.data.invoices.length)} />
            </MetricGrid>
            <DashboardPanel title="Invoices" description="Invoices issued for provider activity.">
              <InvoiceTable invoices={state.data.invoices} showProvider detailBasePath="/operator/invoices" />
            </DashboardPanel>
          </>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function OperatorIssueInvoicePage() {
  const accessToken = useAccessToken();
  const [providerCode, setProviderCode] = useState<ProviderCode>("redPlug");
  const [periodStart, setPeriodStart] = useState(firstDayOfMonth());
  const [periodEnd, setPeriodEnd] = useState(todayDate());
  const [taxAmount, setTaxAmount] = useState("0");
  const [message, setMessage] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  async function issueInvoice(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setInvoice(null);
    try {
      const created = await requestJson<Invoice>("/api/billing/invoices/issue", {
        method: "POST",
        accessToken,
        bodyJson: {
          provider_code: providerCode,
          period_start: dateToUtcStart(periodStart),
          period_end: dateToUtcEnd(periodEnd),
          tax_amount: Number(taxAmount || 0),
        },
      });
      setInvoice(created);
      setMessage(`Issued invoice ${created.invoice_number}.`);
    } catch (caught) {
      setMessage(messageFromUnknownError(caught));
    }
  }

  return (
    <AppShell>
      <DashboardPage
        title="Issue invoice"
        description="Issue a provider invoice from eligible billing charges in the selected period."
      >
        <DashboardPanel title="Invoice parameters" description="Operators can issue invoices; provider admins can only view and pay issued invoices.">
          <form className="admin-form" onSubmit={issueInvoice}>
            <label>
              Provider
              <select value={providerCode} onChange={(event) => setProviderCode(event.target.value as ProviderCode)}>
                {PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>{providerLabel(provider)}</option>
                ))}
              </select>
            </label>
            <label>
              Period start
              <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            </label>
            <label>
              Period end
              <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
            </label>
            <label>
              Tax amount
              <input type="number" min="0" step="0.01" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} />
            </label>
            <button className="button-primary" type="submit">Issue invoice</button>
          </form>
          <InlineResult message={message} tone={invoice ? "success" : "warning"} />
          {invoice ? (
            <p className="muted">Invoice total: {formatMoney(invoice.total_amount, invoice.currency)}</p>
          ) : null}
        </DashboardPanel>
      </DashboardPage>
    </AppShell>
  );
}

export function OperatorPricingPage() {
  const accessToken = useAccessToken();
  const [reloadKey, setReloadKey] = useState(0);
  const [providerCode, setProviderCode] = useState<"" | ProviderCode>("");
  const [name, setName] = useState("Provider pricing rule");
  const [reservationFee, setReservationFee] = useState("1.00");
  const [pointViewFee, setPointViewFee] = useState("0.05");
  const [pointViewEnabled, setPointViewEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const state = useDashboardLoad(
    () => requestJson<PricingRule[]>("/api/billing/pricing/rules", { accessToken }),
    [accessToken, reloadKey],
  );

  async function createRule(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await requestJson<PricingRule>("/api/billing/pricing/rules", {
        method: "POST",
        accessToken,
        bodyJson: {
          provider_code: providerCode || null,
          name,
          active: true,
          currency: "EUR",
          reservation_success_fee: Number(reservationFee || 0),
          point_view_fee: Number(pointViewFee || 0),
          point_view_fee_enabled: pointViewEnabled,
          reservation_failure_fee: 0,
        },
      });
      setMessage("Pricing rule created.");
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setMessage(messageFromUnknownError(caught));
    }
  }

  async function toggleRule(rule: PricingRule) {
    setMessage(null);
    try {
      await requestJson<PricingRule>(`/api/billing/pricing/rules/${rule.id}`, {
        method: "PATCH",
        accessToken,
        bodyJson: { active: !rule.active },
      });
      setMessage(`${rule.name} ${rule.active ? "disabled" : "enabled"}.`);
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setMessage(messageFromUnknownError(caught));
    }
  }

  return (
    <AppShell>
      <DashboardPage
        title="Pricing controls"
        description="Manage global pricing defaults and provider-specific pricing overrides."
      >
        <DashboardGrid>
          <DashboardPanel title="Create pricing rule" description="Rules apply globally when provider is empty, otherwise to one provider.">
            <form className="admin-form" onSubmit={createRule}>
              <label>
                Provider scope
                <select value={providerCode} onChange={(event) => setProviderCode(event.target.value as "" | ProviderCode)}>
                  <option value="">Global default</option>
                  {PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>{providerLabel(provider)}</option>
                  ))}
                </select>
              </label>
              <label>
                Rule name
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                Reservation success fee
                <input type="number" min="0" step="0.01" value={reservationFee} onChange={(event) => setReservationFee(event.target.value)} />
              </label>
              <label>
                Point view fee
                <input type="number" min="0" step="0.01" value={pointViewFee} onChange={(event) => setPointViewFee(event.target.value)} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={pointViewEnabled} onChange={(event) => setPointViewEnabled(event.target.checked)} />
                Enable point view fee
              </label>
              <button className="button-primary" type="submit">Create rule</button>
            </form>
            <InlineResult message={message} tone={message?.includes("created") || message?.includes("enabled") || message?.includes("disabled") ? "success" : "warning"} />
          </DashboardPanel>
          <DashboardPanel title="Pricing rules" description="Active rules determine charges for provider activity.">
            <LoadState loading={state.loading} error={state.error} />
            {state.data ? (
              <DataTable
                rows={state.data}
                getRowKey={(row) => row.id}
                columns={[
                  { key: "scope", label: "Scope", render: (row) => row.provider_code ? providerLabel(row.provider_code) : "Global" },
                  { key: "name", label: "Name", render: (row) => row.name },
                  { key: "reservation", label: "Reservation", render: (row) => formatMoney(row.reservation_success_fee, row.currency) },
                  { key: "view", label: "View fee", render: (row) => row.point_view_fee_enabled ? formatMoney(row.point_view_fee, row.currency) : "Disabled" },
                  { key: "active", label: "Active", render: (row) => (row.active ? "Yes" : "No") },
                  {
                    key: "action",
                    label: "Action",
                    render: (row) => (
                      <button className="button-secondary" type="button" onClick={() => toggleRule(row)}>
                        {row.active ? "Disable" : "Enable"}
                      </button>
                    ),
                  },
                ]}
              />
            ) : null}
          </DashboardPanel>
        </DashboardGrid>
      </DashboardPage>
    </AppShell>
  );
}

export function OperatorSyncPage() {
  const accessToken = useAccessToken();
  const [providerCode, setProviderCode] = useState<ProviderCode>("redPlug");
  const [message, setMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const schedulerState = useDashboardLoad(async () => {
    const [jobs, runs] = await Promise.all([
      requestJson<SchedulerJob[]>("/api/scheduler/jobs", { accessToken }),
      requestJson<SchedulerRun[]>("/api/scheduler/runs?limit=10", { accessToken }),
    ]);
    return { jobs, runs };
  }, [accessToken, refreshKey]);

  async function runAction(label: string, action: () => Promise<unknown>, after?: () => void) {
    setMessage(null);
    try {
      const response = await action();
      setMessage(`${label} completed: ${JSON.stringify(response)}`);
      after?.();
    } catch (caught) {
      setMessage(messageFromUnknownError(caught));
    }
  }

  function schedulerJobLabel(jobKey: string): string {
    return jobKey.replace(/\./g, " ");
  }

  return (
    <AppShell>
      <DashboardPage
        title="Sync controls"
        description="Run scheduled maintenance jobs, pause automation, and adjust refresh cadence."
      >
        <section className="admin-toolbar">
          <label>
            Provider
            <select value={providerCode} onChange={(event) => setProviderCode(event.target.value as ProviderCode)}>
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{providerLabel(provider)}</option>
              ))}
            </select>
          </label>
          <button
            className="button-primary"
            type="button"
            onClick={() => runAction(
              "Maintenance sequence",
              () => requestJson<SchedulerSequenceRun>("/api/scheduler/jobs/run-maintenance", { method: "POST", accessToken }),
              () => setRefreshKey((value) => value + 1),
            )}
          >
            Run maintenance sequence
          </button>
        </section>
        <DashboardGrid>
          <DashboardPanel title="Scheduler control plane" description="Manage scheduled jobs, manual runs, pause controls, and job intervals.">
            <LoadState loading={schedulerState.loading} error={schedulerState.error} />
            {schedulerState.data ? (
              <DataTable
                rows={schedulerState.data.jobs}
                getRowKey={(row) => row.job_key}
                columns={[
                  { key: "job", label: "Job", render: (row) => schedulerJobLabel(row.job_key) },
                  { key: "target", label: "Destination", render: (row) => row.target_service },
                  {
                    key: "schedule",
                    label: "Schedule",
                    render: (row) => (
                      <SchedulerScheduleEditor
                        accessToken={accessToken}
                        job={row}
                        onSaved={() => setRefreshKey((value) => value + 1)}
                        onMessage={setMessage}
                      />
                    ),
                  },
                  { key: "enabled", label: "Enabled", render: (row) => (row.enabled ? "Yes" : "No") },
                  { key: "last", label: "Last run", render: (row) => row.last_run_status ?? "None" },
                  { key: "next", label: "Next run", render: (row) => formatDateTime(row.next_run_at) },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <div className="button-row">
                        <button
                          className="button-primary"
                          type="button"
                          onClick={() => runAction(`Scheduler run ${row.job_key}`, () => requestJson<SchedulerRun>(`/api/scheduler/jobs/${encodeURIComponent(row.job_key)}/run`, { method: "POST", accessToken }), () => setRefreshKey((value) => value + 1))}
                        >
                          Run
                        </button>
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => runAction(row.enabled ? `Pause ${row.job_key}` : `Resume ${row.job_key}`, () => requestJson<SchedulerJob>(`/api/scheduler/jobs/${encodeURIComponent(row.job_key)}/${row.enabled ? "pause" : "resume"}`, { method: "POST", accessToken }), () => setRefreshKey((value) => value + 1))}
                        >
                          {row.enabled ? "Pause" : "Resume"}
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            ) : null}
          </DashboardPanel>
          <DashboardPanel title="Scheduler run history" description="Recent scheduled job activity.">
            <LoadState loading={schedulerState.loading} error={schedulerState.error} />
            {schedulerState.data ? (
              <DataTable
                rows={schedulerState.data.runs}
                getRowKey={(row) => row.id}
                emptyLabel="No scheduler runs recorded"
                columns={[
                  { key: "job", label: "Job", render: (row) => schedulerJobLabel(row.job_key) },
                  { key: "status", label: "Status", render: (row) => row.status },
                  { key: "trigger", label: "Trigger", render: (row) => row.trigger_type },
                  { key: "http", label: "HTTP", render: (row) => row.target_http_status ?? "None" },
                  { key: "duration", label: "Duration", render: (row) => row.duration_ms === null ? "None" : `${row.duration_ms}ms` },
                  { key: "finished", label: "Finished", render: (row) => formatDateTime(row.finished_at) },
                ]}
              />
            ) : null}
          </DashboardPanel>
          <DashboardPanel title="Catalog sync" description="Refresh provider charging-point data.">
            <div className="button-row">
              <button className="button-secondary" type="button" onClick={() => runAction("All-provider import", () => requestJson<CatalogImportAllResponse>("/api/catalog/imports/all", { method: "POST", accessToken }))}>Import all providers</button>
              <button className="button-primary" type="button" onClick={() => runAction(`${providerCode} import`, () => requestJson<CatalogImportSummary>(`/api/catalog/imports/providers/${providerCode}`, { method: "POST", accessToken }))}>Import selected provider</button>
            </div>
          </DashboardPanel>
          <DashboardPanel title="Analytics refresh" description="Process recent analytics activity and update provider, operator, point, status, and EV summaries.">
            <div className="button-row">
              <button className="button-secondary" type="button" onClick={() => runAction("Analytics queue drain", () => requestJson<QueueDrainResponse>("/api/analytics/events/consume?limit=100", { method: "POST", accessToken }))}>Drain analytics queue</button>
              <button className="button-primary" type="button" onClick={() => runAction("Analytics refresh", () => requestJson<AggregateRefreshResponse>("/api/analytics/aggregates/refresh", { method: "POST", accessToken }))}>Refresh analytics summaries</button>
            </div>
          </DashboardPanel>
          <DashboardPanel title="Billing refresh" description="Process recent billing activity and publish pending billing updates.">
            <div className="button-row">
              <button className="button-secondary" type="button" onClick={() => runAction("Billing queue drain", () => requestJson<QueueDrainResponse>("/api/billing/events/drain?limit=100", { method: "POST", accessToken }))}>Drain billing queue</button>
              <button className="button-primary" type="button" onClick={() => runAction("Billing outbox publish", () => requestJson("/api/billing/events/outbox/publish-pending?limit=100", { method: "POST", accessToken }))}>Publish billing outbox</button>
            </div>
          </DashboardPanel>
          <DashboardPanel title="Reservation updates" description="Publish pending reservation updates after completed reservation attempts.">
            <button className="button-primary" type="button" onClick={() => runAction("Reservation outbox publish", () => requestJson("/api/reservations/events/outbox/publish-pending?limit=100", { method: "POST", accessToken }))}>Publish reservation outbox</button>
          </DashboardPanel>
        </DashboardGrid>
        <InlineResult message={message} tone={message?.includes("completed") ? "success" : "warning"} />
      </DashboardPage>
    </AppShell>
  );
}

export function OperatorSystemPage() {
  const accessToken = useAccessToken();
  const state = useDashboardLoad(async () => {
    const healthPaths = [
      ["/api/auth/health", "auth-service"],
      ["/api/providers/health", "provider-registry-service"],
      ["/api/catalog/health", "catalog-service"],
      ["/api/status/health", "status-service"],
      ["/api/reservations/health", "reservation-service"],
      ["/api/analytics/health", "analytics-service"],
      ["/api/billing/health", "billing-service"],
      ["/api/scheduler/health", "scheduler-service"],
    ] as const;
    const health = await Promise.all(
      healthPaths.map(async ([path, label]) => {
        try {
          const response = await requestJson<Record<string, unknown>>(path, { accessToken });
          return { label, ok: true, response };
        } catch (caught) {
          return { label, ok: false, response: messageFromUnknownError(caught) };
        }
      }),
    );
    const [catalogFreshness, statusFreshness, imports, schedulerHealth, schedulerRuns] = await Promise.all([
      requestJson<ProviderFreshness[]>("/api/catalog/freshness", { accessToken }),
      requestJson<StatusProviderFreshness[]>("/api/status/freshness", { accessToken }),
      requestJson<CatalogImportRun[]>("/api/catalog/imports/runs?limit=10", { accessToken }),
      requestJson<SchedulerHealth>("/api/scheduler/health", { accessToken }),
      requestJson<SchedulerRun[]>("/api/scheduler/runs?limit=10", { accessToken }),
    ]);
    return { health, catalogFreshness, statusFreshness, imports, schedulerHealth, schedulerRuns };
  }, [accessToken]);

  return (
    <AppShell>
      <DashboardPage
        title="System overview"
        description="Review platform health, availability freshness, and recent background operations."
      >
        <LoadState loading={state.loading} error={state.error} />
        {state.data ? (
          <DashboardGrid>
            <DashboardPanel title="Service health" description="Health checks for the deployed platform components.">
              <div className="health-grid">
                {state.data.health.map((row) => (
                  <div className="health-card" key={row.label}>
                    <HealthPill ok={row.ok} label={row.ok ? "Healthy" : "Unavailable"} />
                    <strong>{row.label}</strong>
                    <small>{typeof row.response === "string" ? row.response : "Health endpoint responded"}</small>
                  </div>
                ))}
              </div>
            </DashboardPanel>
            <DashboardPanel title="Scheduler health" description="Current scheduled job availability and run posture.">
              <MetricGrid>
                <MetricCard label="Jobs" value={formatNumber(state.data.schedulerHealth.total_job_count)} />
                <MetricCard label="Enabled" value={formatNumber(state.data.schedulerHealth.enabled_job_count)} />
                <MetricCard label="Running" value={formatNumber(state.data.schedulerHealth.running_job_count)} />
                <MetricCard label="Last status" value={state.data.schedulerHealth.last_run_status ?? "None"} />
              </MetricGrid>
            </DashboardPanel>
            <DashboardPanel title="Catalog freshness" description="Catalog coverage and update freshness by provider.">
              <DataTable
                rows={state.data.catalogFreshness}
                getRowKey={(row) => row.provider_code}
                columns={[
                  { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                  { key: "active", label: "Active", render: (row) => formatNumber(row.active_count) },
                  { key: "stale", label: "Stale", render: (row) => formatNumber(row.stale_count) },
                  { key: "import", label: "Latest import", render: (row) => formatDateTime(row.last_successful_import_at) },
                ]}
              />
            </DashboardPanel>
            <DashboardPanel title="Availability freshness" description="Current and expired availability checks by provider.">
              <DataTable
                rows={state.data.statusFreshness}
                getRowKey={(row) => row.provider_code}
                columns={[
                  { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                  { key: "valid", label: "Current", render: (row) => formatNumber(row.valid_cache_count) },
                  { key: "expired", label: "Needs refresh", render: (row) => formatNumber(row.expired_cache_count) },
                  { key: "checked", label: "Checked", render: (row) => formatDateTime(row.last_checked_at) },
                ]}
              />
            </DashboardPanel>
            <DashboardPanel title="Import runs" description="Latest catalog refresh activity.">
              <ImportRunTable rows={state.data.imports} />
            </DashboardPanel>
            <DashboardPanel title="Scheduler runs" description="Latest scheduled job activity.">
              <DataTable
                rows={state.data.schedulerRuns}
                getRowKey={(row) => row.id}
                emptyLabel="No scheduler runs recorded"
                columns={[
                  { key: "job", label: "Job", render: (row) => row.job_key },
                  { key: "status", label: "Status", render: (row) => row.status },
                  { key: "trigger", label: "Trigger", render: (row) => row.trigger_type },
                  { key: "target", label: "Target", render: (row) => row.target_service },
                  { key: "finished", label: "Finished", render: (row) => formatDateTime(row.finished_at) },
                ]}
              />
            </DashboardPanel>
          </DashboardGrid>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

function TopPointTable({
  rows,
  valueLabel,
  valueSelector,
}: {
  rows: ProviderSummary["top_viewed_points"];
  valueLabel: string;
  valueSelector: (row: ProviderSummary["top_viewed_points"][number]) => number;
}) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row, index) => `${row.provider_code}-${row.external_point_id}-${index}`}
      columns={[
        { key: "point", label: "Point", render: (row) => row.point_name || row.external_point_id },
        { key: "views", label: "Views", render: (row) => formatNumber(row.point_views) },
        { key: "reservations", label: valueLabel, render: (row) => formatNumber(valueSelector(row)) },
        { key: "checks", label: "Status checks", render: (row) => formatNumber(row.status_checks) },
      ]}
    />
  );
}

function InvoiceTable({
  invoices,
  showProvider,
  detailBasePath = "/provider/invoices",
}: {
  invoices: Invoice[];
  showProvider: boolean;
  detailBasePath?: string;
}) {
  return (
    <DataTable
      rows={invoices}
      getRowKey={(row) => row.id}
      columns={[
        ...(showProvider
          ? [{ key: "provider", label: "Provider", render: (row: Invoice) => providerLabel(row.provider_code) }]
          : []),
        { key: "number", label: "Invoice", render: (row) => <Link className="text-link" to={`${detailBasePath}/${row.id}`}>{row.invoice_number}</Link> },
        { key: "status", label: "Status", render: (row) => <InvoiceStatus status={row.status} /> },
        { key: "total", label: "Total", render: (row) => formatMoney(row.total_amount, row.currency) },
        { key: "issued", label: "Issued", render: (row) => formatDateTime(row.issued_at) },
        { key: "paid", label: "Paid", render: (row) => formatDateTime(row.paid_at) },
      ]}
    />
  );
}

function ImportRunTable({ rows }: { rows: CatalogImportRun[] }) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      columns={[
        { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
        { key: "status", label: "Status", render: (row) => <SyncRunStatusBadge status={row.status} /> },
        { key: "fetched", label: "Fetched", render: (row) => formatNumber(row.provider_fetched_count) },
        { key: "changed", label: "Changed", render: (row) => formatNumber(row.catalog_changed_count) },
        { key: "started", label: "Started", render: (row) => formatDateTime(row.started_at) },
        { key: "completed", label: "Completed", render: (row) => formatDateTime(row.completed_at) },
      ]}
    />
  );
}
