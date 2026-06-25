import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { AppShell } from "../../components/AppShell";
import { InvoiceStatusBadge } from "../../components/domain/billing";
import { MapFilterPanel } from "../../components/domain/ev";
import { ProviderHealthBadge } from "../../components/domain/provider";
import { SyncRunStatusBadge } from "../../components/domain/status";
import { StatusBadge } from "../../components/StatusBadge";
import { Switch } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import { messageFromUnknownError, requestJson, requestText } from "../../lib/api";
import { applyStatusLookup, fetchCachedPointStatuses, statusLookupKeyForPoint } from "../../lib/statusLookups";
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatReservedUntil,
  providerLabel,
  PROVIDERS,
  STATUSES,
  statusLabel,
} from "../../lib/formatting";
import type {
  AggregateRefreshResponse,
  AnalyticsRefreshResponse,
  BillingOverview,
  CatalogFilters,
  CatalogImportAllResponse,
  CatalogImportRun,
  CatalogImportSummary,
  CatalogPointListResponse,
  Invoice,
  OperatorDailyTrend,
  OperatorProviderComparison,
  OperatorSummary,
  PointMetric,
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
  SchedulerIntervalPresetResponse,
  SchedulerJob,
  SchedulerRun,
  SchedulerSequenceRun,
  StatusCachePolicy,
  StatusProviderFreshness,
  StatusLookupResponse,
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

const ANALYTICS_TABS = [
  { value: "activity", label: "Activity trend" },
  { value: "status", label: "Views by status" },
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
const OPERATOR_OVERVIEW_TABS = [
  { value: "providers", label: "Provider comparison" },
  { value: "catalog", label: "Catalog health" },
  { value: "imports", label: "Recent imports" },
  { value: "billing", label: "Billing" },
] as const;
type OperatorOverviewTab = (typeof OPERATOR_OVERVIEW_TABS)[number]["value"];

const CATALOG_TABS = [
  { value: "inventory", label: "Point inventory" },
  { value: "coverage", label: "Coverage health" },
  { value: "runs", label: "Import runs" },
] as const;
type CatalogTab = (typeof CATALOG_TABS)[number]["value"];
const PRICING_TABS = [
  { value: "create", label: "Create pricing rule" },
  { value: "rules", label: "Pricing rules" },
] as const;
type PricingTab = (typeof PRICING_TABS)[number]["value"];
const OPERATOR_CATALOG_PAGE_SIZES = [25, 50, 100, "all"] as const;
type OperatorCatalogPageSize = (typeof OPERATOR_CATALOG_PAGE_SIZES)[number];
const PROVIDER_POINT_FETCH_SIZES = [20, 40, 60, 80, 100, "all"] as const;
type ProviderPointFetchSize = (typeof PROVIDER_POINT_FETCH_SIZES)[number];
const PROVIDER_POINT_FILTERS: CatalogFilters = {
  q: "",
  providerCode: "",
  status: "",
  connector: "",
  includeStale: true,
};

const SYNC_TABS = [
  { value: "jobs", label: "Scheduled jobs" },
  { value: "history", label: "Run history" },
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

function formatPercentPoints(value: number): string {
  return `${formatNumber(value)}%`;
}

type SchedulerJobCopy = {
  title: string;
  description: string;
};

type SyncOperationState = {
  label: string;
  status: "running" | "success" | "error";
  detail: string;
};

type SchedulerPresetApplication = {
  scheduler: SchedulerIntervalPresetResponse;
  statusCachePolicy: StatusCachePolicy;
};

type SchedulerRunDurationSummary = {
  key: string;
  title: string;
  runCount: number;
  averageDurationMs: number;
  latestFinishedAt: string | null;
};

type SchedulerControlRow =
  | { kind: "job"; job: SchedulerJob }
  | { kind: "status-cache"; policy: StatusCachePolicy };

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

function summarizeSchedulerRunDurations(runs: SchedulerRun[]): SchedulerRunDurationSummary[] {
  const groups = new Map<string, {
    key: string;
    title: string;
    runCount: number;
    totalDurationMs: number;
    measuredRunCount: number;
    latestFinishedAt: string | null;
  }>();

  for (const run of runs) {
    const title = schedulerJobCopy(run).title;
    const key = title;
    const current = groups.get(key) ?? {
      key,
      title,
      runCount: 0,
      totalDurationMs: 0,
      measuredRunCount: 0,
      latestFinishedAt: null,
    };
    current.runCount += 1;
    if (run.duration_ms !== null && Number.isFinite(run.duration_ms)) {
      current.totalDurationMs += run.duration_ms;
      current.measuredRunCount += 1;
    }
    if (isLaterTimestamp(run.finished_at, current.latestFinishedAt)) {
      current.latestFinishedAt = run.finished_at;
    }
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      title: group.title,
      runCount: group.runCount,
      averageDurationMs: group.measuredRunCount === 0 ? 0 : Math.round(group.totalDurationMs / group.measuredRunCount),
      latestFinishedAt: group.latestFinishedAt,
    }))
    .sort((left, right) => timestampValue(left.latestFinishedAt) - timestampValue(right.latestFinishedAt));
}

function isLaterTimestamp(candidate: string | null, current: string | null): boolean {
  return timestampValue(candidate) > timestampValue(current);
}

function timestampValue(value: string | null): number {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function SchedulerRunDurationChart({
  runs,
  color,
  valueLabel,
}: {
  runs: SchedulerRun[];
  color: string;
  valueLabel: string;
}) {
  const summaries = summarizeSchedulerRunDurations(runs);
  return (
    <div className="scheduler-duration-summary">
      <p className="chart-note">
        Repeated executions are grouped into one bar per operation. The bar value is the average duration across the recent runs shown in the table.
      </p>
      <ColumnChart
        rows={summaries}
        getLabel={(row) => row.title}
        getValue={(row) => row.averageDurationMs}
        valueLabel={valueLabel}
        color={color}
        formatValue={(value) => `${formatNumber(value)} ms`}
      />
      <div className="scheduler-run-summary-list" aria-label="Grouped scheduler run counts">
        {summaries.map((row) => (
          <span key={row.key}>
            <strong>{row.title}</strong>
            {formatNumber(row.runCount)} {row.runCount === 1 ? "run" : "runs"}
          </span>
        ))}
      </div>
    </div>
  );
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
  if (isSchedulerPresetApplication(response)) {
    const jobCount = formatNumber(response.scheduler.updated_count);
    const cacheTtl = `${response.statusCachePolicy.ttl_seconds}s`;
    return response.scheduler.preset === "minimum"
      ? `Applied the minimum interval to ${jobCount} jobs and set the status cache to ${cacheTtl}.`
      : `Restored defaults for ${jobCount} jobs and set the status cache to ${cacheTtl}.`;
  }
  if (isSchedulerIntervalPresetResponse(response)) {
    if (response.preset === "minimum") {
      return `Applied the 30-second minimum to ${formatNumber(response.updated_count)} interval ${response.updated_count === 1 ? "job" : "jobs"}.`;
    }
    return `Restored the documented defaults for ${formatNumber(response.updated_count)} interval ${response.updated_count === 1 ? "job" : "jobs"}.`;
  }
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

function isSchedulerIntervalPresetResponse(value: unknown): value is SchedulerIntervalPresetResponse {
  return isRecord(value)
    && (value.preset === "minimum" || value.preset === "defaults")
    && typeof value.updated_count === "number"
    && Array.isArray(value.jobs);
}

function isSchedulerPresetApplication(value: unknown): value is SchedulerPresetApplication {
  return isRecord(value)
    && isSchedulerIntervalPresetResponse(value.scheduler)
    && isRecord(value.statusCachePolicy)
    && typeof value.statusCachePolicy.ttl_seconds === "number";
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

function ActivityMetricExplanation() {
  return (
    <div className="analytics-explanation-card" aria-label="Activity metric explanations">
      <div>
        <strong>Searches</strong>
        <span>EV users submitting catalog searches for nearby charging options.</span>
      </div>
      <div>
        <strong>Point views</strong>
        <span>Charging-point detail views, a signal of driver interest before reservation.</span>
      </div>
      <div>
        <strong>Successful reservations</strong>
        <span>Confirmed provider reservations that count toward conversion and tracked charging revenue.</span>
      </div>
    </div>
  );
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

function StatusCacheScheduleEditor({
  accessToken,
  policy,
  onSaved,
  onMessage,
}: {
  accessToken: string;
  policy: StatusCachePolicy;
  onSaved: () => void;
  onMessage: (message: string) => void;
}) {
  const initialValue = String(policy.ttl_seconds);
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const nextTtl = Number(value);
      await requestJson<StatusCachePolicy>("/api/status/cache/policy", {
        method: "PATCH",
        accessToken,
        bodyJson: { ttl_seconds: nextTtl },
      });
      onMessage(`Status cache TTL updated to ${nextTtl}s.`);
      onSaved();
    } catch (caught) {
      onMessage(messageFromUnknownError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="scheduler-schedule-form" onSubmit={savePolicy}>
      <label>
        <span>TTL</span>
        <span className="scheduler-input-with-unit">
          <input
            aria-label="status cache ttl seconds"
            min={policy.minimum_ttl_seconds}
            step={30}
            type="number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <small>s</small>
        </span>
      </label>
      <span className="muted">Minimum {policy.minimum_ttl_seconds}s · default {policy.default_ttl_seconds}s</span>
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

async function resolveCatalogPointStatuses(
  accessToken: string,
  catalog: CatalogPointListResponse,
  statusFilter: CatalogFilters["status"] = "",
): Promise<CatalogPointListResponse> {
  const response = await fetchCachedPointStatuses(catalog.items, accessToken);
  const lookups: Record<string, StatusLookupResponse> = Object.fromEntries(
    response.items.map((item) => [statusLookupKeyForPoint(item), item]),
  );
  const items = catalog.items
    .map((point) => applyStatusLookup(point, lookups[statusLookupKeyForPoint(point)]))
    .filter((point) => !statusFilter || point.status === statusFilter);
  return {
    ...catalog,
    items,
    total: statusFilter ? items.length : catalog.total,
  };
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
  query: string,
  filters: CatalogFilters,
): Promise<CatalogPointListResponse> {
  const effectiveFetchSize: ProviderPointFetchSize = filters.status ? "all" : fetchSize;
  const requestPage = (limit: number, offset: number) => {
    const params = new URLSearchParams({
      providerCode,
      includeStale: String(filters.includeStale),
      limit: String(limit),
      offset: String(offset),
    });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (filters.connector.trim()) {
      params.set("connector", filters.connector.trim());
    }
    return requestJson<CatalogPointListResponse>(`/api/catalog/points?${params.toString()}`, { accessToken });
  };

  if (effectiveFetchSize !== "all") {
    return resolveCatalogPointStatuses(
      accessToken,
      scopeCatalogToProvider(await requestPage(effectiveFetchSize, 0), providerCode),
      filters.status,
    );
  }

  const firstPage = await requestPage(500, 0);
  const offsets: number[] = [];
  for (let offset = firstPage.limit; offset < firstPage.total; offset += firstPage.limit) {
    offsets.push(offset);
  }
  const remainingPages = await Promise.all(offsets.map((offset) => requestPage(firstPage.limit, offset)));
  return resolveCatalogPointStatuses(
    accessToken,
    scopeCatalogToProvider(
      {
        ...firstPage,
        items: [firstPage, ...remainingPages].flatMap((response) => response.items),
        limit: firstPage.total,
        offset: 0,
      },
      providerCode,
    ),
    filters.status,
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
  const [filters, setFilters] = useState<CatalogFilters>(PROVIDER_POINT_FILTERS);
  const [fetchSize, setFetchSize] = useState<ProviderPointFetchSize>(20);
  const state = useDashboardLoad(async () => {
    const code = requireProvider(providerCode);
    const catalog = await loadProviderCatalogPoints(accessToken, code, fetchSize, query, filters);
    return { catalog };
  }, [accessToken, providerCode, query, filters, fetchSize]);

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
        </section>
        <MapFilterPanel
          filters={filters}
          providers={[]}
          statuses={STATUSES}
          resultLimit="all"
          resultLimitOptions={[]}
          onChange={(nextFilters) => setFilters({ ...nextFilters, q: "", providerCode: "" })}
          onResultLimitChange={() => undefined}
          showSearch={false}
          showProvider={false}
          showResultLimit={false}
          summary="Expand to refine this provider's charging points."
          expandedSummary="Narrow this provider's catalog by availability, status, charger type, and freshness."
        />
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
                { key: "reserved", label: "Reservation", render: (row) => row.status === "reserved" && row.reservation_ends_at ? formatReservedUntil(row.reservation_ends_at) : "Not reserved" },
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
  }, [accessToken, providerCode, fromDate, toDate]);
  const summary = state.data?.summary ?? null;
  const currency = summary?.currency ?? "EUR";
  const statusDistribution = summary?.status_distribution ?? {};

  return (
    <AppShell>
      <DashboardPage
        title="Your performance"
        description="Review demand, reservations, availability checks, and revenue signals for your charging network."
      >
        <section className="admin-toolbar provider-date-toolbar">
          <label className="catalog-page-size">
            From
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label className="catalog-page-size">
            To
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
        </section>
        <LoadState loading={state.loading} error={state.error} />
        {summary ? (
          <>
            <MetricGrid>
              <MetricCard label="Searches" value={formatNumber(summary.total_searches)} />
              <MetricCard
                label="Cache hit rate"
                value={formatPercent(summary.status_cache_hit_rate)}
                hint={`${formatNumber(summary.status_cache_hits)} cached · ${formatNumber(summary.status_provider_calls)} live refreshes`}
              />
              <MetricCard label="Failed reservations" value={formatNumber(summary.failed_reservations)} />
              <MetricCard label="Tracked revenue" value={formatMoney(summary.observed_amount, currency)} hint="Estimated EV charging payments" />
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
                  <ActivityMetricExplanation />
                </DashboardPanel>
              ) : null}
              {activeTab === "status" ? (
                <DashboardPanel title="Point views by status" description="How many point-detail views happened while the point was available, reserved, charging, offline, malfunctioning, or unknown.">
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
                      {
                        label: "Conversion %",
                        color: "#7c3aed",
                        getValue: (row) => (row.reservation_conversion_rate ?? 0) * 100,
                        formatValue: formatPercentPoints,
                      },
                    ]}
                    label="Reservation conversion"
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "revenue" ? (
                <DashboardPanel title="Tracked revenue" description="Estimated EV charging payments from successful reservations, based on duration, charger power, and cost/kWh.">
                  <ColumnChart
                    rows={state.data?.trends ?? []}
                    getLabel={(row) => new Date(row.day_bucket).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    getValue={(row) => row.observed_amount}
                    valueLabel="Tracked revenue"
                    color="#f59e0b"
                    formatValue={(value) => formatMoney(value, "EUR")}
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
  const state = useDashboardLoad(async () => {
    const code = requireProvider(providerCode);
    const query = providerQuery(code);
    const [invoices, overview] = await Promise.all([
      requestJson<Invoice[]>(`/api/billing/invoices${query}`, { accessToken }),
      requestJson<BillingOverview>(`/api/billing/providers/${code}/overview`, { accessToken }),
    ]);
    return { invoices, overview };
  }, [accessToken, providerCode]);
  const currency = effectiveCurrency(state.data?.overview ?? null);

  return (
    <AppShell>
      <DashboardPage
        title="Your invoices"
        description="Review issued invoices, payment status, and outstanding balances."
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
            <button className="button-primary admin-form-centered-action" type="submit">Download CSV</button>
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
  const [activeTab, setActiveTab] = useState<OperatorOverviewTab>("providers");
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
            <DashboardTabs
              items={[...OPERATOR_OVERVIEW_TABS]}
              value={activeTab}
              onValueChange={setActiveTab}
              label="Operator overview detail views"
            >
              {activeTab === "providers" ? (
                <DashboardPanel title="Provider comparison" description="Reservation conversion by provider.">
                  <BarList
                    rows={data.summary.provider_comparison}
                    getLabel={(row) => providerLabel(row.provider_code)}
                    getValue={(row) => (row.reservation_conversion_rate ?? 0) * 100}
                    formatValue={formatPercentPoints}
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "catalog" ? (
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
              ) : null}
              {activeTab === "imports" ? (
                <DashboardPanel title="Recent import runs" description="Latest catalog refresh attempts across providers.">
                  <ImportRunTable rows={data.imports} />
                </DashboardPanel>
              ) : null}
              {activeTab === "billing" ? (
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
              ) : null}
            </DashboardTabs>
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const state = useDashboardLoad(async () => {
    const [summary, comparison, trends, freshness] = await Promise.all([
      requestJson<OperatorSummary>("/api/analytics/operator/summary", { accessToken }),
      requestJson<OperatorProviderComparison[]>("/api/analytics/operator/provider-comparison", { accessToken }),
      requestJson<OperatorDailyTrend[]>("/api/analytics/operator/trends/daily", { accessToken }),
      requestJson("/api/analytics/operator/freshness", { accessToken }),
    ]);
    return { summary, comparison, trends, freshness };
  }, [accessToken, refreshKey]);
  const summary = state.data?.summary ?? null;

  async function refreshStats() {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const response = await requestJson<AnalyticsRefreshResponse>("/api/analytics/operator/refresh?limit=100", {
        method: "POST",
        accessToken,
      });
      setRefreshMessage(
        `Stats refreshed. ${formatNumber(response.consumed.ack_count)} analytics events processed; summaries rebuilt ${formatDateTime(response.aggregates.refreshed_at)}.`,
      );
      setRefreshKey((current) => current + 1);
    } catch (caught) {
      setRefreshMessage(messageFromUnknownError(caught));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <AppShell>
      <DashboardPage
        title="Operator analytics"
        description="Review platform-wide demand, usage, and provider performance."
      >
        <section className="operator-refresh-toolbar">
          <div>
            <strong>Analytics statistics</strong>
            <span>Process the current analytics queue batch, then rebuild all dashboard summaries.</span>
          </div>
          <button className="button-primary" disabled={refreshing} onClick={refreshStats} type="button">
            {refreshing ? "Refreshing stats..." : "Refresh stats"}
          </button>
        </section>
        <InlineResult message={refreshMessage} tone={refreshMessage?.startsWith("Stats refreshed") ? "success" : "warning"} />
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
                  <ActivityMetricExplanation />
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
                    formatValue={formatPercentPoints}
                  />
                </DashboardPanel>
              ) : null}
              {activeTab === "revenue" ? (
                <DashboardPanel title="Tracked revenue" description="Estimated EV charging payments from successful reservations by provider.">
                  <ColumnChart
                    rows={state.data?.comparison ?? []}
                    getLabel={(row) => providerLabel(row.provider_code)}
                    getValue={(row) => row.observed_amount}
                    valueLabel="Tracked revenue"
                    color="#f59e0b"
                    formatValue={(value) => formatMoney(value, "EUR")}
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
    return resolveCatalogPointStatuses(accessToken, await requestPage(pageSize, page * pageSize));
  }

  const firstPage = await requestPage(500, 0);
  const offsets: number[] = [];
  for (let offset = firstPage.limit; offset < firstPage.total; offset += firstPage.limit) {
    offsets.push(offset);
  }
  const remainingPages = await Promise.all(offsets.map((offset) => requestPage(firstPage.limit, offset)));
  return resolveCatalogPointStatuses(accessToken, {
    ...firstPage,
    items: [firstPage, ...remainingPages].flatMap((response) => response.items),
    limit: firstPage.total,
    offset: 0,
  });
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
  const [importOperation, setImportOperation] = useState<SyncOperationState | null>(null);
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
  const importRunning = importOperation?.status === "running";

  useEffect(() => {
    if (pageSize !== "all" && page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [page, pageSize, totalPages]);

  async function triggerImport(allProviders: boolean) {
    const label = allProviders
      ? "all provider catalog import"
      : `${providerLabel(providerCode as ProviderCode)} catalog import`;
    setImportOperation({
      label,
      status: "running",
      detail: "This catalog import is running now. The page will update when it finishes.",
    });
    try {
      let response: CatalogImportAllResponse | CatalogImportSummary;
      if (allProviders) {
        response = await requestJson<CatalogImportAllResponse>("/api/catalog/imports/all", {
          method: "POST",
          accessToken,
        });
      } else if (providerCode) {
        response = await requestJson<CatalogImportSummary>(`/api/catalog/imports/providers/${providerCode}`, {
          method: "POST",
          accessToken,
        });
      } else {
        return;
      }
      setImportOperation({ label, status: "success", detail: describeOperationResult(response) });
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setImportOperation({ label, status: "error", detail: messageFromUnknownError(caught) });
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
          <button className="button-secondary" type="button" disabled={importRunning} onClick={() => triggerImport(true)}>Import all</button>
          <button className="button-primary" type="button" disabled={!providerCode || importRunning} onClick={() => triggerImport(false)}>Import selected</button>
        </section>
        <SyncOperationProgress operation={importOperation} />
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
                    { key: "reserved", label: "Reservation", render: (row) => row.status === "reserved" && row.reservation_ends_at ? formatReservedUntil(row.reservation_ends_at) : "Not reserved" },
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
                  <article className="freshness-chart-card">
                    <div className="freshness-chart-heading">
                      <strong>Active catalog records</strong>
                      <span>Charging-point records currently available in the aggregated catalog.</span>
                    </div>
                    <ColumnChart
                      rows={state.data.freshness}
                      getLabel={(row) => providerLabel(row.provider_code)}
                      getValue={(row) => row.active_count}
                      valueLabel="Active points"
                      color="#10b981"
                    />
                  </article>
                  <div className="freshness-chart-divider" aria-hidden="true" />
                  <article className="freshness-chart-card">
                    <div className="freshness-chart-heading">
                      <strong>Stale catalog records</strong>
                      <span>Charging-point records that need a successful provider catalog import.</span>
                    </div>
                    <ColumnChart
                      rows={state.data.freshness}
                      getLabel={(row) => providerLabel(row.provider_code)}
                      getValue={(row) => row.stale_count}
                      valueLabel="Stale points"
                      color="#f59e0b"
                    />
                  </article>
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
  const state = useDashboardLoad(async () => {
    const [invoices, overview] = await Promise.all([
      requestJson<Invoice[]>("/api/billing/invoices", { accessToken }),
      requestJson<BillingOverview>("/api/billing/overview", { accessToken }),
    ]);
    return { invoices, overview };
  }, [accessToken]);
  const currency = effectiveCurrency(state.data?.overview ?? null);

  return (
    <AppShell>
      <DashboardPage
        title="Operator invoices"
        description="Monitor issued invoices and provider billing exposure."
      >
        <section className="invoice-action-row" aria-label="Invoice actions">
          <Link className="button-primary button-link invoice-issue-button" to="/operator/invoices/new">Issue invoice</Link>
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
            <button className="button-primary admin-form-centered-action" type="submit">Issue invoice</button>
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
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [activePricingTab, setActivePricingTab] = useState<PricingTab>("create");
  const [providerCode, setProviderCode] = useState<"" | ProviderCode>("");
  const [name, setName] = useState("Provider pricing rule");
  const [reservationFee, setReservationFee] = useState("1.00");
  const [pointViewFee, setPointViewFee] = useState("0.05");
  const [pointViewEnabled, setPointViewEnabled] = useState(true);
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const state = useDashboardLoad(
    () => requestJson<PricingRule[]>("/api/billing/pricing/rules", { accessToken }),
    [accessToken, reloadKey],
  );

  useEffect(() => {
    if (state.data) {
      setRules(state.data);
    }
  }, [state.data]);

  async function createRule(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const created = await requestJson<PricingRule>("/api/billing/pricing/rules", {
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
      setRules((current) => applyPricingActivationTransition([...current, created], created.id, created.active));
      setMessage("Pricing rule created.");
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setMessage(messageFromUnknownError(caught));
    }
  }

  async function toggleRule(rule: PricingRule) {
    setMessage(null);
    setPendingRuleId(rule.id);
    const previousRules = rules;
    const nextActive = !rule.active;
    setRules((current) => applyPricingActivationTransition(current, rule.id, nextActive));
    try {
      await requestJson<PricingRule>(`/api/billing/pricing/rules/${rule.id}`, {
        method: "PATCH",
        accessToken,
        bodyJson: { active: nextActive },
      });
      setMessage(`${rule.name} ${nextActive ? "activated" : "deactivated"}.`);
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setRules(previousRules);
      setMessage(messageFromUnknownError(caught));
    } finally {
      setPendingRuleId(null);
    }
  }

  return (
    <AppShell>
      <DashboardPage
        title="Pricing controls"
        description="Manage global pricing defaults and provider-specific pricing overrides."
      >
        <DashboardTabs
          items={[...PRICING_TABS]}
          value={activePricingTab}
          onValueChange={setActivePricingTab}
          label="Operator pricing views"
        >
          <InlineResult
            message={message}
            tone={message?.includes("created") || message?.includes("activated") || message?.includes("deactivated") ? "success" : "warning"}
          />
          {activePricingTab === "create" ? (
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
            </DashboardPanel>
          ) : null}
          {activePricingTab === "rules" ? (
            <DashboardPanel title="Pricing rules" description="Active rules determine charges for provider activity.">
              <LoadState loading={state.loading} error={state.error} />
              {state.data ? (
                <DataTable
                  rows={rules}
                  getRowKey={(row) => row.id}
                  columns={[
                    { key: "scope", label: "Scope", render: (row) => row.provider_code ? providerLabel(row.provider_code) : "Global" },
                    { key: "name", label: "Name", render: (row) => row.name },
                    { key: "reservation", label: "Reservation", render: (row) => formatMoney(row.reservation_success_fee, row.currency) },
                    { key: "view", label: "View fee", render: (row) => row.point_view_fee_enabled ? formatMoney(row.point_view_fee, row.currency) : "Disabled" },
                    {
                      key: "active",
                      label: "On / off",
                      render: (row) => (
                        <label className="pricing-rule-toggle">
                          <Switch
                            aria-label={`Toggle ${row.name} pricing rule`}
                            checked={row.active}
                            disabled={pendingRuleId !== null}
                            onChange={() => toggleRule(row)}
                          />
                          <span>{row.active ? "On" : "Off"}</span>
                        </label>
                      ),
                    },
                  ]}
                />
              ) : null}
            </DashboardPanel>
          ) : null}
        </DashboardTabs>
      </DashboardPage>
    </AppShell>
  );
}

function applyPricingActivationTransition(
  rules: PricingRule[],
  targetRuleId: string,
  nextActive: boolean,
): PricingRule[] {
  const targetRule = rules.find((rule) => rule.id === targetRuleId);
  if (!targetRule) {
    return rules;
  }

  if (!nextActive) {
    return rules.map((rule) => (rule.id === targetRuleId ? { ...rule, active: false } : rule));
  }

  const providerCode = targetRule.provider_code;
  const nextRules = rules.map((rule) => {
    if (providerCode === null) {
      return { ...rule, active: rule.id === targetRuleId };
    }
    if (rule.provider_code === providerCode) {
      return { ...rule, active: rule.id === targetRuleId };
    }
    return rule;
  });

  if (providerCode !== null && PROVIDERS.every((provider) => (
    nextRules.some((rule) => rule.provider_code === provider && rule.active)
  ))) {
    return nextRules.map((rule) => (
      rule.provider_code === null ? { ...rule, active: false } : rule
    ));
  }

  return nextRules;
}

export function OperatorSyncPage() {
  const accessToken = useAccessToken();
  const [providerCode, setProviderCode] = useState<"" | ProviderCode>("");
  const [activeTab, setActiveTab] = useState<SyncTab>("jobs");
  const [message, setMessage] = useState<string | null>(null);
  const [operation, setOperation] = useState<SyncOperationState | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const schedulerState = useDashboardLoad(async () => {
    const [jobs, runs, statusCachePolicy] = await Promise.all([
      requestJson<SchedulerJob[]>("/api/scheduler/jobs", { accessToken }),
      requestJson<SchedulerRun[]>("/api/scheduler/runs?limit=10", { accessToken }),
      requestJson<StatusCachePolicy>("/api/status/cache/policy", { accessToken }),
    ]);
    return { jobs, runs, statusCachePolicy };
  }, [accessToken, refreshKey]);
  const operationRunning = operation?.status === "running";

  async function applySchedulerPreset(preset: "minimum" | "defaults"): Promise<SchedulerPresetApplication> {
    if (!schedulerState.data) {
      throw new Error("Scheduler configuration is still loading.");
    }
    const cacheTtlSeconds = preset === "minimum"
      ? schedulerState.data.statusCachePolicy.minimum_ttl_seconds
      : schedulerState.data.statusCachePolicy.default_ttl_seconds;
    const [scheduler, statusCachePolicy] = await Promise.all([
      requestJson<SchedulerIntervalPresetResponse>(
        `/api/scheduler/jobs/intervals/${preset === "minimum" ? "apply-minimum" : "reset-defaults"}`,
        { method: "POST", accessToken },
      ),
      requestJson<StatusCachePolicy>("/api/status/cache/policy", {
        method: "PATCH",
        accessToken,
        bodyJson: { ttl_seconds: cacheTtlSeconds },
      }),
    ]);
    return { scheduler, statusCachePolicy };
  }

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
          meta={schedulerState.data ? `${schedulerState.data.jobs.length} jobs · status cache ${schedulerState.data.statusCachePolicy.ttl_seconds}s` : undefined}
        >
          {activeTab === "jobs" ? (
            <DashboardPanel
              title="Scheduler control plane"
              description="Manage scheduled jobs, manual runs, pause controls, job intervals, and status cache timing."
              actions={(
                <div className="scheduler-preset-actions" aria-label="Scheduler interval presets">
                  <button
                    className="button-secondary"
                    type="button"
                    title="Apply the minimum operator policy to interval jobs and the status cache"
                    disabled={operationRunning || schedulerState.loading || !schedulerState.data}
                    onClick={() => runAction(
                      "apply minimum refresh policy",
                      () => applySchedulerPreset("minimum"),
                      () => setRefreshKey((value) => value + 1),
                    )}
                  >
                    Apply minimum
                  </button>
                  <button
                    className="button-primary"
                    type="button"
                    title="Restore documented defaults for interval jobs and the status cache"
                    disabled={operationRunning || schedulerState.loading || !schedulerState.data}
                    onClick={() => runAction(
                      "reset default refresh policy",
                      () => applySchedulerPreset("defaults"),
                      () => setRefreshKey((value) => value + 1),
                    )}
                  >
                    Reset defaults
                  </button>
                </div>
              )}
            >
              <LoadState loading={schedulerState.loading} error={schedulerState.error} />
              {schedulerState.data ? (
                <DataTable
                  className="scheduler-table"
                  rows={[
                    ...schedulerState.data.jobs.map((job): SchedulerControlRow => ({ kind: "job", job })),
                    { kind: "status-cache" as const, policy: schedulerState.data.statusCachePolicy },
                  ]}
                  getRowKey={(row) => (row.kind === "job" ? row.job.job_key : "status-cache-policy")}
                  columns={[
                    {
                      key: "job",
                      label: "Job",
                      render: (row) => {
                        if (row.kind === "status-cache") {
                          return (
                            <span className="scheduler-job-cell">
                              <strong>Status cache TTL</strong>
                              <small>Controls how long cached charging-point statuses stay valid before a point tap refreshes them.</small>
                            </span>
                          );
                        }
                        const copy = schedulerJobCopy(row.job);
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
                      render: (row) => (
                        <span className="scheduler-target-service">
                          {row.kind === "status-cache" ? "Status" : serviceDisplayName(row.job.target_service)}
                        </span>
                      ),
                    },
                    {
                      key: "schedule",
                      label: "Schedule",
                      render: (row) => (row.kind === "status-cache" ? (
                        <StatusCacheScheduleEditor
                          accessToken={accessToken}
                          policy={row.policy}
                          onSaved={() => setRefreshKey((value) => value + 1)}
                          onMessage={setMessage}
                        />
                      ) : (
                        <SchedulerScheduleEditor
                          accessToken={accessToken}
                          job={row.job}
                          onSaved={() => setRefreshKey((value) => value + 1)}
                          onMessage={setMessage}
                        />
                      )),
                    },
                    {
                      key: "enabled",
                      label: "Enabled",
                      render: (row) => (row.kind === "status-cache"
                        ? <SyncRunStatusBadge status="active" />
                        : <SyncRunStatusBadge status={row.job.enabled ? "active" : "paused"} />),
                    },
                    {
                      key: "last",
                      label: "Last run",
                      render: (row) => (row.kind === "status-cache"
                        ? "Policy"
                        : <SyncRunStatusBadge status={row.job.last_run_status ?? "unknown"} />),
                    },
                    {
                      key: "next",
                      label: "Next run",
                      render: (row) => (row.kind === "status-cache" ? "On demand" : formatDateTime(row.job.next_run_at)),
                    },
                    {
                      key: "actions",
                      label: "Actions",
                      render: (row) => {
                        if (row.kind === "status-cache") {
                          return <span className="muted">Saved with TTL</span>;
                        }
                        const copy = schedulerJobCopy(row.job);
                        return (
                          <div className="button-row">
                            <button
                              className="button-primary"
                              type="button"
                              disabled={operationRunning}
                              onClick={() => runAction(
                                copy.title.toLowerCase(),
                                () => requestJson<SchedulerRun>(`/api/scheduler/jobs/${encodeURIComponent(row.job.job_key)}/run`, { method: "POST", accessToken }),
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
                                `${row.job.enabled ? "pause" : "resume"} ${copy.title.toLowerCase()}`,
                                () => requestJson<SchedulerJob>(`/api/scheduler/jobs/${encodeURIComponent(row.job.job_key)}/${row.job.enabled ? "pause" : "resume"}`, { method: "POST", accessToken }),
                                () => setRefreshKey((value) => value + 1),
                              )}
                            >
                              {row.job.enabled ? "Pause" : "Resume"}
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
                  <SchedulerRunDurationChart
                    runs={schedulerState.data.runs}
                    valueLabel="Average run duration (ms)"
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
                <SchedulerRunDurationChart
                  runs={state.data.schedulerRuns}
                  valueLabel="Average run duration milliseconds"
                  color="#7c3aed"
                />
              </DashboardPanel>
            ) : null}
            {activeTab === "freshness" ? (
              <DashboardPanel title="Data freshness" description="Catalog and availability freshness across providers.">
                <p className="chart-note">
                  This view combines two different freshness checks. Provider labels repeat because the left chart checks catalog records, while the right chart checks cached live-status entries.
                </p>
                <div className="analytics-split-charts">
                  <article className="freshness-chart-card">
                    <div className="freshness-chart-heading">
                      <strong>Catalog freshness</strong>
                      <span>Stale catalog points are local charging-point records that need a provider catalog import.</span>
                    </div>
                    <ColumnChart
                      rows={state.data.catalogFreshness}
                      getLabel={(row) => providerLabel(row.provider_code)}
                      getValue={(row) => row.stale_count}
                      valueLabel="Stale catalog points"
                      color="#f59e0b"
                    />
                  </article>
                  <div className="freshness-chart-divider" aria-hidden="true" />
                  <article className="freshness-chart-card">
                    <div className="freshness-chart-heading">
                      <strong>Status cache freshness</strong>
                      <span>Expired status entries are cached availability lookups whose TTL has elapsed and should be refreshed before trusting them.</span>
                    </div>
                    <ColumnChart
                      rows={state.data.statusFreshness}
                      getLabel={(row) => providerLabel(row.provider_code)}
                      getValue={(row) => row.expired_cache_count}
                      valueLabel="Expired status entries"
                      color="#ef4444"
                    />
                  </article>
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
