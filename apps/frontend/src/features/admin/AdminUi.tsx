import type { ReactNode } from "react";

import { Alert, EmptyState, LoadingBlock } from "../../components/Feedback";
import { Card, DataTable as UiDataTable, MetricCard as UiMetricCard, PageHeader, SectionHeader, Tabs } from "../../components/ui";
import { formatNumber } from "../../lib/formatting";
import { cx } from "../../lib/utils/classNames";

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

export function DashboardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("admin-grid", className)}>{children}</section>;
}

export function DashboardPanel({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cx("admin-panel", className)}>
      <SectionHeader title={title} description={description} actions={actions ? <div className="admin-panel-actions">{actions}</div> : null} />
      {children}
    </Card>
  );
}

export function DashboardTabs<T extends string>({
  items,
  value,
  onValueChange,
  meta,
  children,
  label,
}: {
  items: Array<{ value: T; label: string }>;
  value: T;
  onValueChange: (value: T) => void;
  meta?: ReactNode;
  children: ReactNode;
  label: string;
}) {
  return (
    <section className="analytics-explorer" aria-label={label}>
      <div className="analytics-explorer-toolbar">
        <Tabs
          items={items}
          value={value}
          onValueChange={(nextValue) => onValueChange(nextValue as T)}
        />
        {meta ? <span className="analytics-freshness">{meta}</span> : null}
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
  className,
}: {
  columns: Array<{ key: string; label: string; render: (row: T) => ReactNode }>;
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  emptyLabel?: string;
  className?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyLabel}>New rows will appear here when matching activity is available.</EmptyState>;
  }

  return <UiDataTable columns={columns} rows={rows} getRowKey={getRowKey} emptyLabel={emptyLabel} className={className} />;
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

export type ChartSeries<T> = {
  label: string;
  color: string;
  getValue: (row: T) => number;
};

export function TrendChart<T>({
  rows,
  getLabel,
  series,
}: {
  rows: T[];
  getLabel: (row: T) => string;
  series: Array<ChartSeries<T>>;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No trend data available">Daily activity will appear after analytics aggregates are refreshed.</EmptyState>;
  }

  const width = 760;
  const height = 280;
  const padding = { top: 20, right: 18, bottom: 42, left: 42 };
  const values = rows.flatMap((row) => series.map((item) => item.getValue(row)));
  const max = Math.max(1, ...values);
  const x = (index: number) => padding.left + (index * (width - padding.left - padding.right)) / Math.max(1, rows.length - 1);
  const y = (value: number) => height - padding.bottom - (value / max) * (height - padding.top - padding.bottom);

  return (
    <div className="analytics-chart-shell">
      <svg className="analytics-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Provider activity trend">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const lineY = y(max * step);
          return (
            <g key={step}>
              <line x1={padding.left} x2={width - padding.right} y1={lineY} y2={lineY} className="analytics-grid-line" />
              <text x={padding.left - 10} y={lineY + 4} textAnchor="end" className="analytics-axis-label">
                {formatNumber(Math.round(max * step))}
              </text>
            </g>
          );
        })}
        {series.map((item) => {
          const points = rows.map((row, index) => `${x(index)},${y(item.getValue(row))}`).join(" ");
          return (
            <g key={item.label}>
              <polyline points={points} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
              {rows.map((row, index) => (
                <circle key={`${item.label}-${getLabel(row)}`} cx={x(index)} cy={y(item.getValue(row))} r="4" fill={item.color}>
                  <title>{`${item.label}: ${formatNumber(item.getValue(row))} on ${getLabel(row)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {rows.map((row, index) => (
          <text key={getLabel(row)} x={x(index)} y={height - 14} textAnchor="middle" className="analytics-axis-label">
            {getLabel(row)}
          </text>
        ))}
      </svg>
      <div className="analytics-chart-legend">
        {series.map((item) => (
          <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>
        ))}
      </div>
    </div>
  );
}

export function DistributionChart({ rows }: { rows: Array<{ label: string; value: number; color: string }> }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (total === 0) {
    return <EmptyState title="No status data available">Status checks will populate this distribution after analytics refresh.</EmptyState>;
  }

  let offset = 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="analytics-distribution">
      <svg viewBox="0 0 200 200" role="img" aria-label="Charging point status distribution">
        <circle cx="100" cy="100" r={radius} className="analytics-donut-track" />
        {rows.map((row) => {
          const length = (row.value / total) * circumference;
          const segment = (
            <circle
              key={row.label}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={row.color}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeWidth="24"
              transform="rotate(-90 100 100)"
            >
              <title>{`${row.label}: ${formatNumber(row.value)}`}</title>
            </circle>
          );
          offset += length;
          return segment;
        })}
        <text x="100" y="96" textAnchor="middle" className="analytics-donut-total">{formatNumber(total)}</text>
        <text x="100" y="116" textAnchor="middle" className="analytics-donut-caption">checks</text>
      </svg>
      <div className="analytics-distribution-legend">
        {rows.map((row) => (
          <div key={row.label}>
            <span><i style={{ background: row.color }} />{row.label}</span>
            <strong>{formatNumber(row.value)}</strong>
            <small>{Math.round((row.value / total) * 100)}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RankedBars<T>({
  rows,
  getLabel,
  getValue,
  valueLabel,
}: {
  rows: T[];
  getLabel: (row: T) => string;
  getValue: (row: T) => number;
  valueLabel: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No ranked points available">Point rankings will appear after matching activity is aggregated.</EmptyState>;
  }
  const max = Math.max(1, ...rows.map(getValue));
  return (
    <div className="analytics-ranked-bars">
      {rows.map((row, index) => {
        const value = getValue(row);
        return (
          <div className="analytics-ranked-row" key={`${getLabel(row)}-${index}`}>
            <span className="analytics-rank">{index + 1}</span>
            <span className="analytics-ranked-label">{getLabel(row)}</span>
            <span className="analytics-ranked-track"><i style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></span>
            <strong>{formatNumber(value)} {valueLabel}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function ColumnChart<T>({
  rows,
  getLabel,
  getValue,
  valueLabel,
  color = "#2563eb",
}: {
  rows: T[];
  getLabel: (row: T) => string;
  getValue: (row: T) => number;
  valueLabel: string;
  color?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No chart data available">This chart will populate after matching activity is aggregated.</EmptyState>;
  }
  const max = Math.max(1, ...rows.map(getValue));
  return (
    <div className="analytics-column-chart" role="img" aria-label={`${valueLabel} bar chart`}>
      {rows.map((row) => {
        const value = getValue(row);
        return (
          <div className="analytics-column-item" key={getLabel(row)}>
            <strong>{formatNumber(value)}</strong>
            <span className="analytics-column-track">
              <i style={{ height: `${Math.max(5, (value / max) * 100)}%`, background: color }} />
            </span>
            <small title={getLabel(row)}>{getLabel(row)}</small>
          </div>
        );
      })}
    </div>
  );
}

export function GroupedColumnChart<T>({
  rows,
  getLabel,
  series,
  label,
}: {
  rows: T[];
  getLabel: (row: T) => string;
  series: Array<ChartSeries<T>>;
  label: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No chart data available">This chart will populate after matching activity is aggregated.</EmptyState>;
  }
  const values = rows.flatMap((row) => series.map((item) => item.getValue(row)));
  const max = Math.max(1, ...values.filter(Number.isFinite));

  return (
    <div className="analytics-grouped-chart-shell">
      <div className="analytics-grouped-chart" role="img" aria-label={`${label} bar chart`}>
        {rows.map((row) => {
          const rowLabel = getLabel(row);
          return (
            <div className="analytics-grouped-item" key={rowLabel}>
              <div className="analytics-grouped-bars">
                {series.map((item) => {
                  const rawValue = item.getValue(row);
                  const value = Number.isFinite(rawValue) ? rawValue : 0;
                  return (
                    <span className="analytics-grouped-bar-slot" key={item.label}>
                      <strong>{formatNumber(value)}</strong>
                      <i
                        style={{ height: `${Math.max(5, (value / max) * 100)}%`, background: item.color }}
                        title={`${item.label}: ${formatNumber(value)} on ${rowLabel}`}
                      />
                    </span>
                  );
                })}
              </div>
              <small title={rowLabel}>{rowLabel}</small>
            </div>
          );
        })}
      </div>
      <div className="analytics-chart-legend">
        {series.map((item) => (
          <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>
        ))}
      </div>
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
