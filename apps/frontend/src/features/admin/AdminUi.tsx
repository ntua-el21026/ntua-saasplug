import type { ReactNode } from "react";

import { Alert, EmptyState, LoadingBlock } from "../../components/Feedback";
import { formatNumber } from "../../lib/formatting";

export function DashboardPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="page admin-page">
      <section className="page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      {children}
    </main>
  );
}

export function LoadState({
  loading,
  error,
  empty,
  emptyTitle = "No records found",
  emptyMessage = "This view will populate after the relevant service has data.",
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
  return (
    <div className="admin-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
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
    <section className="surface admin-panel">
      <div className="surface-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="admin-panel-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
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
    return <EmptyState title={emptyLabel}>Try again after sync, aggregation, or invoice issuance has run.</EmptyState>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey(row, index)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
    return <EmptyState title={emptyLabel}>Aggregates will appear here after analytics refresh completes.</EmptyState>;
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
