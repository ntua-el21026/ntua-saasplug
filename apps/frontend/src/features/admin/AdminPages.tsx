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
  OperatorDailyTrend,
  OperatorProviderComparison,
  OperatorSummary,
  PointMetric,
  PricingRule,
  ProviderAnalyticsRefreshResponse,
  ProviderBillingRefreshResponse,
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
  ColumnChart,
  DashboardGrid,
  DashboardPage,
  DashboardPanel,
  DashboardTabs,
  DataTable,
  DistributionChart,
  GroupedColumnChart,
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
const ANALYTICS_TABS = [
  { value: "activity", label: "Activity trend" },
  { value: "status", label: "Status distribution" },
  { value: "views", label: "Top viewed points" },
  { value: "reservations", label: "Top reserved points" },
  { value: "conversion", label: "Conversion rate" },
  { value: "revenue", label: "Tracked revenue" },
] as const;
type AnalyticsTab = (typeof ANALYTICS_TABS)[number]["value"];
const OPERATOR_ANALYTICS_TABS = [
  { value: "activity", label: "Platform activity" },
  { value: "reservations", label: "Provider reservations" },
  { value: "conversion", label: "Provider conversion" },
  { value: "revenue", label: "Tracked revenue" },
  { value: "comparison", label: "Comparison table" },
] as const;
type OperatorAnalyticsTab = (typeof OPERATOR_ANALYTICS_TABS)[number]["value"];

const CATALOG_TABS = [
  { value: "inventory", label: "Point inventory" },
  { value: "coverage", label: "Coverage health" },
  { value: "runs", label: "Import runs" },
] as const;
type CatalogTab = (typeof CATALOG_TABS)[number]["value"];
const OPERATOR_CATALOG_PAGE_SIZES = [25, 50, 100, "all"] as const;
type OperatorCatalogPageSize = (typeof OPERATOR_CATALOG_PAGE_SIZES)[number];
const PROVIDER_POINT_FETCH_SIZES = [20, 40, 60, 80, 100, "all"] as const;
type ProviderPointFetchSize = (typeof PROVIDER_POINT_FETCH_SIZES)[number];

const SYNC_TABS = [
  { value: "jobs", label: "Scheduled jobs" },
  { value: "history", label: "Run history" },
  { value: "manual", label: "Manual operations" },
] as const;
type SyncTab = (typeof SYNC_TABS)[number]["value"];

const SYSTEM_TABS = [
  { value: "services", label: "Service health" },
  { value: "scheduler", label: "Scheduler posture" },
  { value: "freshness", label: "Data freshness" },
  { value: "activity", label: "Background activity" },
] as const;
type SystemTab = (typeof SYSTEM_TABS)[number]["value"];

const STATUS_COLORS: Record<string, string> = {
  available: "#10b981",
  charging: "#2563eb",
  reserved: "#f59e0b",
  malfunction: "#ef4444",
  offline: "#64748b",
  unknown: "#94a3b8",
};

type SchedulerJobCopy = {
  title: string;
  description: string;
};

type SyncOperationState = {
  label: string;
  status: "running" | "success" | "error";
  detail: string;
};

const SCHEDULER_JOB_COPY: Record<string, SchedulerJobCopy> = {
  "catalog.import.all": {
    title: "Import all provider catalogs",
    description: "Fetch the latest charging points from every enabled provider and refresh the aggregated catalog.",
  },
  "catalog.import.red": {
    title: "Import redPlug catalog",
    description: "Refresh redPlug charging-point records in the aggregated catalog.",
  },
  "catalog.import.green": {
    title: "Import greenPlug catalog",
    description: "Refresh greenPlug charging-point records in the aggregated catalog.",
  },
  "catalog.import.blue": {
    title: "Import bluePlug catalog",
    description: "Refresh bluePlug charging-point records in the aggregated catalog.",
  },
  "analytics.consume-events": {
    title: "Process analytics events",
    description: "Move waiting activity events into analytics storage so dashboards can use them.",
  },
  "analytics.refresh-aggregates": {
    title: "Refresh analytics summaries",
    description: "Rebuild provider, operator, point, status, and EV summary metrics from stored events.",
  },
  "analytics.refresh-aggregates.manual": {
    title: "Refresh analytics summaries",
    description: "Rebuild dashboard metrics immediately from already-ingested activity.",
  },
  "billing.drain-events": {
    title: "Process billing events",
    description: "Read recent billable activity and prepare billing-owned charge records.",
  },
  "billing.drain-events.manual": {
    title: "Process billing events",
    description: "Read waiting billing activity immediately and prepare charge records.",
  },
  "billing.publish-outbox": {
    title: "Publish billing updates",
    description: "Send pending billing, invoice, and payment updates after billing has stored them.",
  },
  "billing.prepare-invoices": {
    title: "Prepare invoice previews",
    description: "Create invoice-ready summaries for operator review without issuing invoices.",
  },
  "reservation.publish-outbox": {
    title: "Publish reservation updates",
    description: "Send pending reservation outcome updates after reservation attempts are stored.",
  },
};

function titleFromJobKey(jobKey: string): string {
  return jobKey
    .split(".")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " "))
    .join(" ");
}

function schedulerJobCopy(job: SchedulerJob | SchedulerRun | string): SchedulerJobCopy {
  const jobKey = typeof job === "string" ? job : job.job_key;
  const fallbackDescription = typeof job === "string" ? "" : "description" in job ? job.description : "";
  return SCHEDULER_JOB_COPY[jobKey] ?? {
    title: titleFromJobKey(jobKey),
    description: fallbackDescription || "Runs a scheduled maintenance task for the selected service.",
  };
}

function serviceDisplayName(service: string): string {
  const labels: Record<string, string> = {
    "analytics-service": "Analytics",
    "billing-service": "Billing",
    "catalog-service": "Catalog",
    "reservation-service": "Reservations",
    "scheduler-service": "Scheduler",
  };
  return labels[service] ?? titleFromJobKey(service.replace(/-service$/, ""));
}

function formatCronSchedule(job: SchedulerJob): string {
  if (!job.cron_expression) {
    return "Cron schedule not set";
  }
  if (job.job_key === "billing.prepare-invoices" && job.cron_expression === "30 2 * * *") {
    return `Daily at 02:30 (${job.timezone})`;
  }
  return `${job.cron_expression} (${job.timezone})`;
}

function describeOperationResult(response: unknown): string {
  if (isSchedulerSequenceRun(response)) {
    return `${formatNumber(response.runs.length)} scheduled ${response.runs.length === 1 ? "job" : "jobs"} finished with ${statusLabel(response.status)} status.`;
  }
  if (isSchedulerRun(response)) {
    return `The job finished with ${statusLabel(response.status)} status.`;
  }
  if (isCatalogImportAllResponse(response)) {
    return `Catalog import finished for ${formatNumber(response.providers.length)} ${response.providers.length === 1 ? "provider" : "providers"}.`;
  }
  if (isCatalogImportSummary(response)) {
    return `${providerLabel(response.provider_code)} import finished: ${formatNumber(response.provider_fetched_count)} fetched, ${formatNumber(response.catalog_changed_count)} changed.`;
  }
  if (isQueueDrainResponse(response)) {
    return `${formatNumber(response.received_count)} events received, ${formatNumber(response.ack_count)} acknowledged.`;
  }
  if (isAggregateRefreshResponse(response)) {
    return `${formatNumber(response.usage_event_count)} usage events summarized at ${formatDateTime(response.refreshed_at)}.`;
  }
  if (isSchedulerJob(response)) {
    return `Job automation is now ${response.enabled ? "enabled" : "paused"}.`;
  }
  return "The operation finished successfully.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isSchedulerSequenceRun(value: unknown): value is SchedulerSequenceRun {
  return isRecord(value) && Array.isArray(value.runs) && typeof value.status === "string";
}

function isSchedulerRun(value: unknown): value is SchedulerRun {
  return isRecord(value) && typeof value.job_key === "string" && typeof value.status === "string" && "duration_ms" in value;
}

function isSchedulerJob(value: unknown): value is SchedulerJob {
  return isRecord(value) && typeof value.job_key === "string" && typeof value.enabled === "boolean" && "schedule_type" in value;
}

function isCatalogImportAllResponse(value: unknown): value is CatalogImportAllResponse {
  return isRecord(value) && Array.isArray(value.providers);
}

function isCatalogImportSummary(value: unknown): value is CatalogImportSummary {
  return isRecord(value) && typeof value.provider_code === "string" && "provider_fetched_count" in value;
}

function isQueueDrainResponse(value: unknown): value is QueueDrainResponse {
  return isRecord(value) && typeof value.received_count === "number" && typeof value.ack_count === "number";
}

function isAggregateRefreshResponse(value: unknown): value is AggregateRefreshResponse {
  return isRecord(value) && typeof value.usage_event_count === "number" && typeof value.refreshed_at === "string";
}

function SyncOperationProgress({ operation }: { operation: SyncOperationState | null }) {
  if (!operation) {
    return null;
  }

  const isRunning = operation.status === "running";
  const title = isRunning
    ? `Running ${operation.label}`
    : operation.status === "success"
      ? `Finished ${operation.label}`
      : `${operation.label} did not finish`;

  return (
    <div className={`sync-operation-progress sync-operation-${operation.status}`} aria-live="polite">
      <div>
        <strong>{title}</strong>
        <span>{operation.detail}</span>
      </div>
      <div
        className="sync-progress-track"
        role="progressbar"
        aria-label={`${operation.label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isRunning ? undefined : 100}
      >
        <span />
      </div>
    </div>
  );
}

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
        <span>{job.schedule_type === "interval" ? "Interval" : "Schedule"}</span>
        <span className="scheduler-input-with-unit">
          <input
            aria-label={`${job.job_key} ${job.schedule_type === "interval" ? "interval seconds" : "cron expression"}`}
            min={job.schedule_type === "interval" ? 30 : undefined}
            step={job.schedule_type === "interval" ? 60 : undefined}
            type={job.schedule_type === "interval" ? "number" : "text"}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <small>{job.schedule_type === "interval" ? "s" : "cron"}</small>
        </span>
      </label>
      <span className="muted">{job.schedule_type === "cron" ? formatCronSchedule(job) : formatSchedule(job)}</span>
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
  const alreadyProviderScoped = catalog.items.every((point) => point.provider_code === providerCode);
  return { ...catalog, items, total: alreadyProviderScoped ? catalog.total : items.length };
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

async function loadProviderCatalogPoints(
  accessToken: string,
  providerCode: ProviderCode,
  fetchSize: ProviderPointFetchSize,
  includeStale: boolean,
  query: string,
): Promise<CatalogPointListResponse> {
  const requestPage = (limit: number, offset: number) => {
    const params = new URLSearchParams({
      providerCode,
      includeStale: String(includeStale),
      limit: String(limit),
      offset: String(offset),
    });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    return requestJson<CatalogPointListResponse>(`/api/catalog/points?${params.toString()}`, { accessToken });
  };

  if (fetchSize !== "all") {
    return scopeCatalogToProvider(await requestPage(fetchSize, 0), providerCode);
  }

  const firstPage = await requestPage(500, 0);
  const offsets: number[] = [];
  for (let offset = firstPage.limit; offset < firstPage.total; offset += firstPage.limit) {
    offsets.push(offset);
  }
  const remainingPages = await Promise.all(offsets.map((offset) => requestPage(firstPage.limit, offset)));
  return scopeCatalogToProvider(
    {
      ...firstPage,
      items: [firstPage, ...remainingPages].flatMap((response) => response.items),
      limit: firstPage.total,
      offset: 0,
    },
    providerCode,
  );
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
        title="Your network overview"
        description="Monitor demand, reservations, catalog health, and billing at a glance."
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
              <DashboardPanel title="Recent invoices" description="Latest invoices and payment status for your account.">
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
  const [fetchSize, setFetchSize] = useState<ProviderPointFetchSize>(20);
  const state = useDashboardLoad(async () => {
    const code = requireProvider(providerCode);
    const catalog = await loadProviderCatalogPoints(accessToken, code, fetchSize, includeStale, query);
    return { catalog };
  }, [accessToken, providerCode, query, includeStale, fetchSize]);

  return (
    <AppShell>
      <DashboardPage
        title="Your charging points"
        description="Review the charging points currently available to drivers."
      >
        <section className="admin-toolbar">
          <label>
            Search points
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, address, external ID" />
          </label>
          <label className="catalog-page-size">
            Entries fetched
            <select
              value={String(fetchSize)}
              onChange={(event) => {
                const value = event.target.value;
                setFetchSize(value === "all" ? "all" : (Number(value) as ProviderPointFetchSize));
              }}
            >
              {PROVIDER_POINT_FETCH_SIZES.map((size) => (
                <option key={String(size)} value={String(size)}>
                  {size === "all" ? "Full list" : `${size} entries`}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={includeStale} onChange={(event) => setIncludeStale(event.target.checked)} />
            Include stale points
          </label>
        </section>
        <LoadState loading={state.loading} error={state.error} />
        {state.data ? (
          <DashboardPanel
            title="Charging point inventory"
            description={`${state.data.catalog.items.length} shown from ${state.data.catalog.total} matching charging points.`}
          >
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
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function ProviderAnalyticsPage() {
  const accessToken = useAccessToken();
  const providerCode = useProviderCode();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("activity");
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayDate());
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const state = useDashboardLoad(async () => {
    const code = requireProvider(providerCode);
    const params = new URLSearchParams({ providerCode: code, from: fromDate, to: toDate });
    const query = params.toString();
    const [summary, trends, topViews, topReservations, freshness] = await Promise.all([
      requestJson<ProviderSummary>(`/api/analytics/provider/summary?${query}`, { accessToken }),
      requestJson<ProviderDailyTrend[]>(`/api/analytics/provider/trends/daily?${query}`, { accessToken }),
      requestJson<PointMetric[]>(`/api/analytics/provider/top-points?${query}&metric=views&limit=8`, { accessToken }),
      requestJson<PointMetric[]>(`/api/analytics/provider/top-points?${query}&metric=reservations&limit=8`, { accessToken }),
      requestJson<ProviderSummary["data_freshness"]>(`/api/analytics/provider/freshness?${query}`, { accessToken }),
    ]);
    return { summary, trends, topViews, topReservations, freshness };
  }, [accessToken, providerCode, refreshKey, fromDate, toDate]);
  const summary = state.data?.summary ?? null;
  const currency = summary?.currency ?? "EUR";
  const statusDistribution = summary?.status_distribution ?? {};

  const refreshAnalytics = async () => {
    const code = requireProvider(providerCode);
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const payload = await requestJson<ProviderAnalyticsRefreshResponse>(
        `/api/analytics/provider/refresh?providerCode=${encodeURIComponent(code)}&limit=${DEFAULT_LIMIT}`,
        { method: "POST", accessToken },
      );
      setRefreshMessage(
        `Analytics updated. ${formatNumber(payload.consumed.ack_count)} recent activity updates applied; dashboard updated ${formatDateTime(payload.aggregates.refreshed_at)}.`,
      );
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setRefreshMessage(messageFromUnknownError(error));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AppShell>
      <DashboardPage
        title="Your performance"
        description="Review demand, reservations, availability checks, and revenue signals for your charging network."
      >
        <section className="admin-toolbar">
          <div className="admin-toolbar-copy">
            <strong>Update your performance data</strong>
            <span className="muted">Bring the latest charging activity into this dashboard.</span>
          </div>
          <label className="catalog-page-size">
            From
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label className="catalog-page-size">
            To
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <button className="button-primary" type="button" onClick={refreshAnalytics} disabled={refreshing || !providerCode}>
            {refreshing ? "Updating" : "Update analytics"}
          </button>
        </section>
        <InlineResult message={refreshMessage} tone={refreshMessage?.startsWith("Analytics updated") ? "success" : "warning"} />
        <LoadState loading={state.loading} error={state.error} />
        {summary ? (
          <>
            <MetricGrid>
              <MetricCard label="Searches" value={formatNumber(summary.total_searches)} />
              <MetricCard label="Status checks" value={formatNumber(summary.total_status_checks)} />
              <MetricCard label="Failed reservations" value={formatNumber(summary.failed_reservations)} />
              <MetricCard label="Tracked revenue" value={formatMoney(summary.observed_amount, currency)} />
            </MetricGrid>
            <DashboardTabs
              items={[...ANALYTICS_TABS]}
              value={activeTab}
              onValueChange={setActiveTab}
              label="Analytics detail views"
              meta={`Updated ${formatDateTime(state.data?.freshness?.last_aggregate_computed_at)}`}
            >
              {activeTab === "activity" ? (
                <DashboardPanel title="Activity trend" description="Daily demand and reservation outcomes for the selected period.">
                  <GroupedColumnChart
                    rows={state.data?.trends ?? []}
                    getLabel={(row) => new Date(row.day_bucket).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    series={[
                      { label: "Searches", color: "#0ea5e9", getValue: (row) => row.searches },
                      { label: "Point views", color: "#2563eb", getValue: (row) => row.point_views },
                      { label: "Successful reservations", color: "#10b981", getValue: (row) => row.successful_reservations },
                      { label: "Failed reservations", color: "#ef4444", getValue: (row) => row.failed_reservations },
                    ]}
                    label="Provider activity"
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "status" ? (
                <DashboardPanel title="Status distribution" description="Availability mix from your charging-point checks in the selected period.">
                  <DistributionChart
                    rows={Object.entries(statusDistribution).map(([status, value]) => ({
                      label: statusLabel(status),
                      value,
                      color: STATUS_COLORS[status] ?? STATUS_COLORS.unknown,
                    }))}
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "views" ? (
                <DashboardPanel title="Top viewed points" description="Charging points receiving the most driver attention.">
                  <ColumnChart
                    rows={state.data?.topViews ?? []}
                    getLabel={(row) => row.point_name || row.external_point_id || "Unknown point"}
                    getValue={(row) => row.point_views}
                    valueLabel="Point views"
                    color="#2563eb"
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "reservations" ? (
                <DashboardPanel title="Top reserved points" description="Charging points leading reservation activity.">
                  <ColumnChart
                    rows={state.data?.topReservations ?? []}
                    getLabel={(row) => row.point_name || row.external_point_id || "Unknown point"}
                    getValue={(row) => row.successful_reservations}
                    valueLabel="Successful reservations"
                    color="#10b981"
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "conversion" ? (
                <DashboardPanel title="Reservation conversion" description="Daily successful reservations as a share of point views.">
                  <GroupedColumnChart
                    rows={state.data?.trends ?? []}
                    getLabel={(row) => new Date(row.day_bucket).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    series={[
                      { label: "Conversion %", color: "#7c3aed", getValue: (row) => (row.reservation_conversion_rate ?? 0) * 100 },
                    ]}
                    label="Reservation conversion"
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "revenue" ? (
                <DashboardPanel title="Tracked revenue" description="Daily revenue signals from completed billable activity.">
                  <ColumnChart
                    rows={state.data?.trends ?? []}
                    getLabel={(row) => new Date(row.day_bucket).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    getValue={(row) => row.observed_amount}
                    valueLabel="Tracked revenue"
                    color="#f59e0b"
                  />
                </DashboardPanel>
              ) : null}
            </DashboardTabs>
          </>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

export function ProviderInvoicesPage() {
  const accessToken = useAccessToken();
  const providerCode = useProviderCode();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const state = useDashboardLoad(async () => {
    const code = requireProvider(providerCode);
    const query = providerQuery(code);
    const [invoices, overview] = await Promise.all([
      requestJson<Invoice[]>(`/api/billing/invoices${query}`, { accessToken }),
      requestJson<BillingOverview>(`/api/billing/providers/${code}/overview`, { accessToken }),
    ]);
    return { invoices, overview };
  }, [accessToken, providerCode, refreshKey]);
  const currency = effectiveCurrency(state.data?.overview ?? null);

  const refreshBilling = async () => {
    const code = requireProvider(providerCode);
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const payload = await requestJson<ProviderBillingRefreshResponse>(
        `/api/billing/providers/${encodeURIComponent(code)}/refresh?limit=${DEFAULT_LIMIT}`,
        { method: "POST", accessToken },
      );
      setRefreshMessage(`Billing updated. ${formatNumber(payload.drained.ack_count)} recent billing updates applied.`);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setRefreshMessage(messageFromUnknownError(error));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AppShell>
      <DashboardPage
        title="Your invoices"
        description="Review issued invoices, payment status, and outstanding balances."
      >
        <section className="admin-toolbar">
          <div className="admin-toolbar-copy">
            <strong>Update your billing view</strong>
            <span className="muted">Bring recent charges into your invoice balances.</span>
          </div>
          <button className="button-primary" type="button" onClick={refreshBilling} disabled={refreshing || !providerCode}>
            {refreshing ? "Updating" : "Update billing"}
          </button>
        </section>
        <InlineResult message={refreshMessage} tone={refreshMessage?.startsWith("Billing updated") ? "success" : "warning"} />
        <LoadState loading={state.loading} error={state.error} />
        {state.data ? (
          <>
            <MetricGrid>
              <MetricCard label="Unpaid" value={formatMoney(state.data.overview.unpaid_amount, currency)} />
              <MetricCard label="Paid" value={formatMoney(state.data.overview.paid_amount, currency)} />
              <MetricCard label="Unbilled" value={formatMoney(state.data.overview.unbilled_amount, currency)} />
              <MetricCard label="Issued invoices" value={formatNumber(state.data.overview.issued_invoice_count)} />
            </MetricGrid>
            <DashboardPanel title="Invoices" description="Open an invoice to review charges and record a full payment.">
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
        title={invoice ? invoice.invoice_number : "Your invoice"}
        description="Review the invoice charges and record payment when the invoice is issued."
      >
        <LoadState loading={state.loading} error={state.error} />
        {invoice ? (
          <DashboardGrid>
            <DashboardPanel title="Invoice summary" description={`Billing period ${formatDateTime(invoice.period_start)} to ${formatDateTime(invoice.period_end)}.`}>
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
        title="Your usage export"
        description="Download a CSV report of your account activity for the selected period."
      >
        <DashboardPanel title="Download your report" description="Exports include only activity from your account.">
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
    const [provider, config, billing, auditLogs] = await Promise.all([
      requestJson<ProviderRecord>(`/api/providers/providers/${code}`, { accessToken }),
      requestJson<ProviderIntegrationConfig>(`/api/providers/providers/${code}/integration-config`, { accessToken }),
      requestJson<BillingOverview>(`/api/billing/providers/${code}/overview`, { accessToken }),
      requestJson<ProviderAuditLog[]>(`/api/providers/providers/${code}/audit-logs`, { accessToken }),
    ]);
    return { provider, config, billing, pricing: billing.effective_pricing, auditLogs };
  }, [accessToken, providerCode]);

  return (
    <AppShell>
      <DashboardPage
        title="Your settings"
        description="Review your company details, connection information, pricing, and recent account changes."
      >
        <LoadState loading={state.loading} error={state.error} />
        {state.data ? (
          <DashboardGrid>
            <DashboardPanel title="Your profile" description="Business details shown for your charging network.">
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
            <DashboardPanel title="Connection details" description="How your charging network is connected to saasPlug.">
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
            <DashboardPanel title="Your pricing" description="Pricing currently applied to activity from your account.">
              {state.data.pricing ? (
                <dl className="admin-definition-list">
                  <div>
                    <dt>Rule</dt>
                    <dd>{state.data.pricing.name}</dd>
                  </div>
                  <div>
                    <dt>Scope</dt>
                    <dd>{state.data.pricing.provider_code ? `${providerLabel(state.data.pricing.provider_code)} override` : "Global default"}</dd>
                  </div>
                  <div>
                    <dt>Successful reservation</dt>
                    <dd>{formatMoney(state.data.pricing.reservation_success_fee, state.data.pricing.currency)}</dd>
                  </div>
                  <div>
                    <dt>Failed reservation</dt>
                    <dd>{formatMoney(state.data.pricing.reservation_failure_fee, state.data.pricing.currency)}</dd>
                  </div>
                  <div>
                    <dt>Point view</dt>
                    <dd>{state.data.pricing.point_view_fee_enabled ? formatMoney(state.data.pricing.point_view_fee, state.data.pricing.currency) : "Disabled"}</dd>
                  </div>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{formatDateTime(state.data.pricing.updated_at)}</dd>
                  </div>
                </dl>
              ) : (
                <div className="pricing-empty-state">
                  <strong>No active pricing rule</strong>
                  <span>Ask an operator to configure pricing for your account.</span>
                </div>
              )}
            </DashboardPanel>
            <DashboardPanel title="Recent changes" description="Recent updates made to your profile and connection details.">
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
  const [activeTab, setActiveTab] = useState<OperatorAnalyticsTab>("activity");
  const state = useDashboardLoad(async () => {
    const [summary, comparison, trends, freshness] = await Promise.all([
      requestJson<OperatorSummary>("/api/analytics/operator/summary", { accessToken }),
      requestJson<OperatorProviderComparison[]>("/api/analytics/operator/provider-comparison", { accessToken }),
      requestJson<OperatorDailyTrend[]>("/api/analytics/operator/trends/daily", { accessToken }),
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
            <DashboardTabs
              items={[...OPERATOR_ANALYTICS_TABS]}
              value={activeTab}
              onValueChange={setActiveTab}
              label="Operator analytics views"
              meta={`Updated ${formatDateTime(summary.last_aggregate_computed_at)}`}
            >
              {activeTab === "activity" ? (
                <DashboardPanel title="Platform activity" description="Daily demand and reservation outcomes across all providers.">
                  <GroupedColumnChart
                    rows={state.data?.trends ?? []}
                    getLabel={(row) => new Date(row.day_bucket).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    series={[
                      { label: "Searches", color: "#0ea5e9", getValue: (row) => row.total_searches },
                      { label: "Point views", color: "#2563eb", getValue: (row) => row.total_point_views },
                      { label: "Successful reservations", color: "#10b981", getValue: (row) => row.successful_reservations },
                      { label: "Failed reservations", color: "#ef4444", getValue: (row) => row.failed_reservations },
                    ]}
                    label="Platform activity"
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "reservations" ? (
                <DashboardPanel title="Provider reservations" description="Successful reservation volume by provider.">
                  <ColumnChart
                    rows={state.data?.comparison ?? []}
                    getLabel={(row) => providerLabel(row.provider_code)}
                    getValue={(row) => row.successful_reservations}
                    valueLabel="Successful reservations"
                    color="#10b981"
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "conversion" ? (
                <DashboardPanel title="Provider conversion" description="Successful reservations as a share of point views.">
                  <ColumnChart
                    rows={state.data?.comparison ?? []}
                    getLabel={(row) => providerLabel(row.provider_code)}
                    getValue={(row) => (row.reservation_conversion_rate ?? 0) * 100}
                    valueLabel="Conversion percent"
                    color="#7c3aed"
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "revenue" ? (
                <DashboardPanel title="Tracked revenue" description="Revenue signals from completed billable activity by provider.">
                  <ColumnChart
                    rows={state.data?.comparison ?? []}
                    getLabel={(row) => providerLabel(row.provider_code)}
                    getValue={(row) => row.observed_amount}
                    valueLabel="Tracked revenue"
                    color="#f59e0b"
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "comparison" ? (
                <DashboardPanel title="Provider comparison" description="Global metrics by provider.">
                <DataTable
                  rows={state.data?.comparison ?? []}
                  getRowKey={(row) => row.provider_code}
                  columns={[
                    { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                    { key: "views", label: "Views", render: (row) => formatNumber(row.total_point_views) },
                    { key: "status", label: "Status checks", render: (row) => formatNumber(row.total_status_checks) },
                    { key: "conversion", label: "Conversion", render: (row) => formatPercent(row.reservation_conversion_rate) },
                    { key: "amount", label: "Tracked revenue", render: (row) => formatMoney(row.observed_amount) },
                  ]}
                />
              </DashboardPanel>
              ) : null}
            </DashboardTabs>
          </>
        ) : null}
      </DashboardPage>
    </AppShell>
  );
}

async function loadOperatorCatalogPoints(
  accessToken: string,
  providerCode: "" | ProviderCode,
  pageSize: OperatorCatalogPageSize,
  page: number,
): Promise<CatalogPointListResponse> {
  const requestPage = (limit: number, offset: number) => {
    const params = new URLSearchParams({
      includeStale: "true",
      limit: String(limit),
      offset: String(offset),
    });
    if (providerCode) {
      params.set("providerCode", providerCode);
    }
    return requestJson<CatalogPointListResponse>(`/api/catalog/points?${params.toString()}`, { accessToken });
  };

  if (pageSize !== "all") {
    return requestPage(pageSize, page * pageSize);
  }

  const firstPage = await requestPage(500, 0);
  const offsets: number[] = [];
  for (let offset = firstPage.limit; offset < firstPage.total; offset += firstPage.limit) {
    offsets.push(offset);
  }
  const remainingPages = await Promise.all(offsets.map((offset) => requestPage(firstPage.limit, offset)));
  return {
    ...firstPage,
    items: [firstPage, ...remainingPages].flatMap((response) => response.items),
    limit: firstPage.total,
    offset: 0,
  };
}

function PointStatusGuide() {
  return (
    <section className="point-status-guide" aria-labelledby="point-status-guide-title">
      <h3 id="point-status-guide-title">Point status guide</h3>
      <p><strong>Fresh</strong> means the point was present in the provider's latest catalog import. <strong>Stale</strong> means it disappeared from that latest import, so it is retained for history but excluded from normal EV search and reservation flows.</p>
      <dl>
        <div><dt>Available</dt><dd>The charger is currently reported as ready for use.</dd></div>
        <div><dt>Charging</dt><dd>A charging session is currently in progress.</dd></div>
        <div><dt>Reserved</dt><dd>The charger is held for an active reservation.</dd></div>
        <div><dt>Malfunction</dt><dd>The provider reports a technical fault.</dd></div>
        <div><dt>Offline</dt><dd>The charger is not currently connected or reachable.</dd></div>
        <div><dt>Unknown</dt><dd>No reliable current operational status is available.</dd></div>
      </dl>
    </section>
  );
}

export function OperatorCatalogPage() {
  const accessToken = useAccessToken();
  const [providerCode, setProviderCode] = useState<"" | ProviderCode>("");
  const [activeTab, setActiveTab] = useState<CatalogTab>("inventory");
  const [pageSize, setPageSize] = useState<OperatorCatalogPageSize>(25);
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const state = useDashboardLoad(async () => {
    const [catalog, freshness, runs] = await Promise.all([
      loadOperatorCatalogPoints(accessToken, providerCode, pageSize, page),
      requestJson<ProviderFreshness[]>("/api/catalog/freshness", { accessToken }),
      requestJson<CatalogImportRun[]>("/api/catalog/imports/runs?limit=20", { accessToken }),
    ]);
    return { catalog, freshness, runs };
  }, [accessToken, providerCode, page, pageSize, reloadKey]);
  const totalPages = state.data && pageSize !== "all"
    ? Math.max(1, Math.ceil(state.data.catalog.total / pageSize))
    : 1;
  const firstVisiblePoint = state.data?.catalog.items.length ? state.data.catalog.offset + 1 : 0;
  const lastVisiblePoint = state.data ? state.data.catalog.offset + state.data.catalog.items.length : 0;
  const initialCatalogLoad = state.loading && !state.data;

  useEffect(() => {
    if (pageSize !== "all" && page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [page, pageSize, totalPages]);

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
            <select
              value={providerCode}
              onChange={(event) => {
                setProviderCode(event.target.value as "" | ProviderCode);
                setPage(0);
              }}
            >
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
        <LoadState loading={initialCatalogLoad} error={state.error} />
        {state.data ? (
          <DashboardTabs
            items={[...CATALOG_TABS]}
            value={activeTab}
            onValueChange={setActiveTab}
            label="Catalog health views"
            meta={state.loading ? "Updating..." : `${formatNumber(state.data.catalog.total)} points`}
          >
            {activeTab === "inventory" ? (
              <DashboardPanel
                title="Catalog points"
                description={`${state.data.catalog.total} charging points match the current provider filter.`}
                className="catalog-stable-panel"
                actions={(
                  <label className="catalog-page-size">
                    Results fetched
                    <select
                      value={String(pageSize)}
                      onChange={(event) => {
                        const value = event.target.value;
                        setPageSize(value === "all" ? "all" : Number(value) as OperatorCatalogPageSize);
                        setPage(0);
                      }}
                    >
                      {OPERATOR_CATALOG_PAGE_SIZES.map((size) => (
                        <option key={String(size)} value={String(size)}>
                          {size === "all" ? "All results" : `${size} per page`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              >
                <DataTable
                  rows={state.data.catalog.items}
                  getRowKey={(row) => row.id}
                  columns={[
                    { key: "provider", label: "Provider", render: (row) => providerLabel(row.provider_code) },
                    { key: "point", label: "Point", render: (row) => row.display_name },
                    { key: "status", label: "Operational status", render: (row) => <StatusBadge status={row.status} /> },
                    { key: "freshness", label: "Catalog state", render: (row) => (row.is_stale ? "Stale" : "Fresh") },
                    { key: "synced", label: "Updated", render: (row) => formatDateTime(row.last_catalog_sync_at) },
                  ]}
                />
                <div className="catalog-pagination" aria-label="Catalog point pagination">
                  <span>
                    Showing {formatNumber(firstVisiblePoint)}-{formatNumber(lastVisiblePoint)} of {formatNumber(state.data.catalog.total)}
                  </span>
                  {pageSize !== "all" ? (
                    <div>
                      <button className="button-secondary" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} type="button">
                        Previous
                      </button>
                      <span>Page {page + 1} of {totalPages}</span>
                      <button className="button-secondary" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)} type="button">
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>
                <PointStatusGuide />
              </DashboardPanel>
            ) : null}
            {activeTab === "coverage" ? (
              <DashboardPanel title="Catalog coverage health" description="Active and stale charging-point records by provider." className="catalog-stable-panel">
                <div className="analytics-split-charts">
                  <ColumnChart
                    rows={state.data.freshness}
                    getLabel={(row) => providerLabel(row.provider_code)}
                    getValue={(row) => row.active_count}
                    valueLabel="Active points"
                    color="#10b981"
                  />
                  <ColumnChart
                    rows={state.data.freshness}
                    getLabel={(row) => providerLabel(row.provider_code)}
                    getValue={(row) => row.stale_count}
                    valueLabel="Stale points"
                    color="#f59e0b"
                  />
                </div>
              </DashboardPanel>
            ) : null}
            {activeTab === "runs" ? (
              <DashboardPanel title="Import runs" description="Recent provider import runs." className="catalog-stable-panel">
              <ImportRunTable rows={state.data.runs} />
            </DashboardPanel>
            ) : null}
          </DashboardTabs>
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
  const [providerCode, setProviderCode] = useState<"" | ProviderCode>("");
  const [activeTab, setActiveTab] = useState<SyncTab>("jobs");
  const [message, setMessage] = useState<string | null>(null);
  const [operation, setOperation] = useState<SyncOperationState | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const schedulerState = useDashboardLoad(async () => {
    const [jobs, runs] = await Promise.all([
      requestJson<SchedulerJob[]>("/api/scheduler/jobs", { accessToken }),
      requestJson<SchedulerRun[]>("/api/scheduler/runs?limit=10", { accessToken }),
    ]);
    return { jobs, runs };
  }, [accessToken, refreshKey]);
  const operationRunning = operation?.status === "running";

  async function runAction(label: string, action: () => Promise<unknown>, after?: () => void) {
    setMessage(null);
    setOperation({
      label,
      status: "running",
      detail: "This operation is running now. The page will update when it finishes.",
    });
    try {
      const response = await action();
      setOperation({
        label,
        status: "success",
        detail: describeOperationResult(response),
      });
      after?.();
    } catch (caught) {
      setOperation({
        label,
        status: "error",
        detail: messageFromUnknownError(caught),
      });
    }
  }

  return (
    <AppShell>
      <DashboardPage
        title="Sync controls"
        description="Run scheduled maintenance jobs, pause automation, and adjust refresh cadence."
      >
        <section className="admin-toolbar sync-toolbar">
          <label>
            Provider
            <select value={providerCode} onChange={(event) => setProviderCode(event.target.value as "" | ProviderCode)}>
              <option value="">All providers</option>
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{providerLabel(provider)}</option>
              ))}
            </select>
          </label>
          <button
            className="button-primary"
            type="button"
            disabled={operationRunning}
            onClick={() => runAction(
              `${providerCode ? providerLabel(providerCode) : "all providers"} sequence`,
              () => requestJson<SchedulerSequenceRun>("/api/scheduler/jobs/run-maintenance", {
                method: "POST",
                accessToken,
                bodyJson: { provider_code: providerCode || null },
              }),
              () => setRefreshKey((value) => value + 1),
            )}
          >
            Run {providerCode ? providerLabel(providerCode) : "all providers"} sequence
          </button>
        </section>
        <SyncOperationProgress operation={operation} />
        <DashboardTabs
          items={[...SYNC_TABS]}
          value={activeTab}
          onValueChange={setActiveTab}
          label="Synchronization views"
          meta={schedulerState.data ? `${schedulerState.data.jobs.length} jobs` : undefined}
        >
          {activeTab === "jobs" ? (
            <DashboardPanel title="Scheduler control plane" description="Manage scheduled jobs, manual runs, pause controls, and job intervals.">
              <LoadState loading={schedulerState.loading} error={schedulerState.error} />
              {schedulerState.data ? (
                <DataTable
                  className="scheduler-table"
                  rows={schedulerState.data.jobs}
                  getRowKey={(row) => row.job_key}
                  columns={[
                    {
                      key: "job",
                      label: "Job",
                      render: (row) => {
                        const copy = schedulerJobCopy(row);
                        return (
                          <span className="scheduler-job-cell">
                            <strong>{copy.title}</strong>
                            <small>{copy.description}</small>
                          </span>
                        );
                      },
                    },
                    {
                      key: "target",
                      label: "Runs in",
                      render: (row) => <span className="scheduler-target-service">{serviceDisplayName(row.target_service)}</span>,
                    },
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
                    { key: "enabled", label: "Enabled", render: (row) => <SyncRunStatusBadge status={row.enabled ? "active" : "paused"} /> },
                    { key: "last", label: "Last run", render: (row) => <SyncRunStatusBadge status={row.last_run_status ?? "unknown"} /> },
                    { key: "next", label: "Next run", render: (row) => formatDateTime(row.next_run_at) },
                    {
                      key: "actions",
                      label: "Actions",
                      render: (row) => {
                        const copy = schedulerJobCopy(row);
                        return (
                          <div className="button-row">
                            <button
                              className="button-primary"
                              type="button"
                              disabled={operationRunning}
                              onClick={() => runAction(
                                copy.title.toLowerCase(),
                                () => requestJson<SchedulerRun>(`/api/scheduler/jobs/${encodeURIComponent(row.job_key)}/run`, { method: "POST", accessToken }),
                                () => setRefreshKey((value) => value + 1),
                              )}
                            >
                              Run
                            </button>
                            <button
                              className="button-secondary"
                              type="button"
                              disabled={operationRunning}
                              onClick={() => runAction(
                                `${row.enabled ? "pause" : "resume"} ${copy.title.toLowerCase()}`,
                                () => requestJson<SchedulerJob>(`/api/scheduler/jobs/${encodeURIComponent(row.job_key)}/${row.enabled ? "pause" : "resume"}`, { method: "POST", accessToken }),
                                () => setRefreshKey((value) => value + 1),
                              )}
                            >
                              {row.enabled ? "Pause" : "Resume"}
                            </button>
                          </div>
                        );
                      },
                    },
                  ]}
                />
              ) : null}
            </DashboardPanel>
          ) : null}
          {activeTab === "history" ? (
            <DashboardPanel title="Scheduler run history" description="Recent scheduled job activity and execution duration.">
              <LoadState loading={schedulerState.loading} error={schedulerState.error} />
              {schedulerState.data ? (
                <>
                  <ColumnChart
                    rows={schedulerState.data.runs.slice().reverse()}
                    getLabel={(row) => schedulerJobCopy(row).title}
                    getValue={(row) => row.duration_ms ?? 0}
                    valueLabel="Run duration (ms)"
                    color="#0ea5e9"
                  />
                  <DataTable
                    className="scheduler-history-table"
                    rows={schedulerState.data.runs}
                    getRowKey={(row) => row.id}
                    emptyLabel="No scheduler runs recorded"
                    columns={[
                      { key: "job", label: "Job", render: (row) => schedulerJobCopy(row).title },
                      { key: "status", label: "Status", render: (row) => <SyncRunStatusBadge status={row.status} /> },
                      { key: "trigger", label: "Trigger", render: (row) => statusLabel(row.trigger_type) },
                      { key: "http", label: "HTTP", render: (row) => row.target_http_status ?? "None" },
                      { key: "duration", label: "Duration", render: (row) => row.duration_ms === null ? "None" : `${row.duration_ms} ms` },
                      { key: "finished", label: "Finished", render: (row) => formatDateTime(row.finished_at) },
                    ]}
                  />
                </>
              ) : null}
            </DashboardPanel>
          ) : null}
          {activeTab === "manual" ? (
            <DashboardGrid className="manual-operations-grid">
              <DashboardPanel title="Catalog sync" description="Refresh provider charging-point data.">
                <div className="button-row manual-operation-actions">
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={operationRunning}
                    onClick={() => runAction("all provider catalog import", () => requestJson<CatalogImportAllResponse>("/api/catalog/imports/all", { method: "POST", accessToken }))}
                  >
                    Import all providers
                  </button>
                  <button
                    className="button-primary"
                    type="button"
                    disabled={!providerCode || operationRunning}
                    onClick={() => runAction(
                      `${providerCode ? providerLabel(providerCode) : "selected provider"} catalog import`,
                      () => requestJson<CatalogImportSummary>(`/api/catalog/imports/providers/${providerCode}`, { method: "POST", accessToken }),
                    )}
                  >
                    Import selected provider
                  </button>
                </div>
              </DashboardPanel>
              <DashboardPanel title="Analytics refresh" description="Process recent analytics activity and update provider, operator, point, status, and EV summaries.">
                <div className="button-row manual-operation-actions">
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={operationRunning}
                    onClick={() => runAction("analytics queue drain", () => requestJson<QueueDrainResponse>("/api/analytics/events/consume?limit=100", { method: "POST", accessToken }))}
                  >
                    Drain analytics queue
                  </button>
                  <button
                    className="button-primary"
                    type="button"
                    disabled={operationRunning}
                    onClick={() => runAction("analytics summary refresh", () => requestJson<AggregateRefreshResponse>("/api/analytics/aggregates/refresh", { method: "POST", accessToken }))}
                  >
                    Refresh analytics summaries
                  </button>
                </div>
              </DashboardPanel>
              <DashboardPanel title="Billing refresh" description="Process recent billing activity and publish pending billing updates.">
                <div className="button-row manual-operation-actions">
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={operationRunning}
                    onClick={() => runAction("billing queue drain", () => requestJson<QueueDrainResponse>("/api/billing/events/drain?limit=100", { method: "POST", accessToken }))}
                  >
                    Drain billing queue
                  </button>
                  <button
                    className="button-primary"
                    type="button"
                    disabled={operationRunning}
                    onClick={() => runAction("billing update publish", () => requestJson("/api/billing/events/outbox/publish-pending?limit=100", { method: "POST", accessToken }))}
                  >
                    Publish billing outbox
                  </button>
                </div>
              </DashboardPanel>
              <DashboardPanel title="Reservation updates" description="Publish pending reservation updates after completed reservation attempts.">
                <div className="button-row manual-operation-actions">
                  <button
                    className="button-primary"
                    type="button"
                    disabled={operationRunning}
                    onClick={() => runAction("reservation update publish", () => requestJson("/api/reservations/events/outbox/publish-pending?limit=100", { method: "POST", accessToken }))}
                  >
                    Publish reservation outbox
                  </button>
                </div>
              </DashboardPanel>
            </DashboardGrid>
          ) : null}
        </DashboardTabs>
        <InlineResult message={message} tone={message?.includes("updated") ? "success" : "warning"} />
      </DashboardPage>
    </AppShell>
  );
}

export function OperatorSystemPage() {
  const accessToken = useAccessToken();
  const [activeTab, setActiveTab] = useState<SystemTab>("services");
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
          <DashboardTabs
            items={[...SYSTEM_TABS]}
            value={activeTab}
            onValueChange={setActiveTab}
            label="System overview views"
            meta={`${state.data.health.filter((row) => row.ok).length}/${state.data.health.length} healthy`}
          >
            {activeTab === "services" ? (
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
            ) : null}
            {activeTab === "scheduler" ? (
              <DashboardPanel title="Scheduler posture" description="Current scheduled job availability and recent execution duration.">
                <MetricGrid>
                  <MetricCard label="Jobs" value={formatNumber(state.data.schedulerHealth.total_job_count)} />
                  <MetricCard label="Enabled" value={formatNumber(state.data.schedulerHealth.enabled_job_count)} />
                  <MetricCard label="Running" value={formatNumber(state.data.schedulerHealth.running_job_count)} />
                  <MetricCard label="Last status" value={state.data.schedulerHealth.last_run_status ?? "None"} />
                </MetricGrid>
                <ColumnChart
                  rows={state.data.schedulerRuns.slice().reverse()}
                  getLabel={(row) => row.job_key.replace(/\./g, " ")}
                  getValue={(row) => row.duration_ms ?? 0}
                  valueLabel="Run duration milliseconds"
                  color="#7c3aed"
                />
              </DashboardPanel>
            ) : null}
            {activeTab === "freshness" ? (
              <DashboardPanel title="Data freshness" description="Catalog and availability freshness across providers.">
                <div className="analytics-split-charts">
                  <ColumnChart
                    rows={state.data.catalogFreshness}
                    getLabel={(row) => providerLabel(row.provider_code)}
                    getValue={(row) => row.stale_count}
                    valueLabel="Stale catalog points"
                    color="#f59e0b"
                  />
                  <ColumnChart
                    rows={state.data.statusFreshness}
                    getLabel={(row) => providerLabel(row.provider_code)}
                    getValue={(row) => row.expired_cache_count}
                    valueLabel="Expired status entries"
                    color="#ef4444"
                  />
                </div>
              </DashboardPanel>
            ) : null}
            {activeTab === "activity" ? (
              <DashboardGrid>
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
          </DashboardTabs>
        ) : null}
      </DashboardPage>
    </AppShell>
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
      className="import-runs-table"
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
