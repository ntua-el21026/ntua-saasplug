import type { ReactNode } from "react";

import { Alert, EmptyState, LoadingBlock } from "../../components/Feedback";
import { Card, DataTable as UiDataTable, MetricCard as UiMetricCard, PageHeader, SectionHeader } from "../../components/ui";
import { formatNumber } from "../../lib/formatting";

export function DashboardPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="page admin-page">
      <PageHeader title={title} description={description} />
      {children}
    </main>
  );
}

export function LoadState({
  loading,
  error,
  empty,
  emptyTitle = "No records found",
  emptyMessage = "This view will update when matching activity is available.",
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (loading) {
    return <LoadingBlock label="Loading dashboard data" />;
  }
  if (error) {
    return (
      <Alert tone="danger" title="Dashboard data unavailable">
        {error}
      </Alert>
    );
  }
  if (empty) {
    return <EmptyState title={emptyTitle}>{emptyMessage}</EmptyState>;
  }
  return null;
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <section className="admin-metric-grid">{children}</section>;
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return <UiMetricCard label={label} value={value} hint={hint} />;
}

export function DashboardGrid({ children }: { children: ReactNode }) {
  return <section className="admin-grid">{children}</section>;
}

export function DashboardPanel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="admin-panel">
      <SectionHeader title={title} description={description} actions={actions ? <div className="admin-panel-actions">{actions}</div> : null} />
      {children}
    </Card>
  );
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyLabel = "No rows available",
}: {
  columns: Array<{ key: string; label: string; render: (row: T) => ReactNode }>;
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyLabel}>New rows will appear here when matching activity is available.</EmptyState>;
  }

  return <UiDataTable columns={columns} rows={rows} getRowKey={getRowKey} emptyLabel={emptyLabel} />;
}

export function BarList<T>({
  rows,
  getLabel,
  getValue,
  emptyLabel = "No chart data available",
}: {
  rows: T[];
  getLabel: (row: T) => string;
  getValue: (row: T) => number;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyLabel}>Performance history will appear here when activity is available.</EmptyState>;
  }

  const max = Math.max(1, ...rows.map(getValue));

  return (
    <div className="bar-list">
      {rows.map((row) => {
        const value = getValue(row);
        const width = Math.max(4, Math.round((value / max) * 100));
        return (
          <div className="bar-row" key={getLabel(row)}>
            <span>{getLabel(row)}</span>
            <div className="bar-track" aria-hidden="true">
              <i style={{ width: `${width}%` }} />
            </div>
            <strong>{formatNumber(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function InlineResult({ message, tone = "info" }: { message: string | null; tone?: "info" | "success" | "warning" | "danger" }) {
  if (!message) {
    return null;
  }
  return (
    <Alert tone={tone} title="Action result">
      {message}
    </Alert>
  );
}
