import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cx } from "../../lib/utils/classNames";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: Size }) {
  return <button className={cx("ui-button", `ui-button-${variant}`, `ui-button-${size}`, className)} {...props} />;
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button className={cx("ui-icon-button", className)} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("ui-input", className)} {...props} />;
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="search" className={cx("ui-input", "ui-search-input", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("ui-input", "ui-select", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cx("ui-checkbox", className)} {...props} />;
}

export function Switch({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" role="switch" className={cx("ui-switch", className)} {...props} />;
}

export function Slider({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="range" className={cx("ui-slider", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("ui-input", "ui-textarea", className)} {...props} />;
}

export function Tabs({
  items,
  value,
  onValueChange,
}: {
  items: Array<{ value: string; label: string }>;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="ui-tabs" role="tablist">
      {items.map((item) => (
        <button
          aria-selected={value === item.value}
          className="ui-tab"
          key={item.value}
          onClick={() => onValueChange(item.value)}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("ui-card", className)}>{children}</section>;
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <article className={cx("ui-metric-card", `ui-tone-${tone}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("ui-badge", `ui-tone-${tone}`)}>{children}</span>;
}

export function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("ui-status-badge", `ui-tone-${tone}`)}>{children}</span>;
}

export function FilterChip({
  selected,
  children,
  onRemove,
}: {
  selected?: boolean;
  children: ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className={cx("ui-filter-chip", selected && "is-selected")}>
      {children}
      {onRemove ? (
        <button aria-label="Remove filter" onClick={onRemove} type="button">
          x
        </button>
      ) : null}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="ui-tag">{children}</span>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="ui-tooltip" data-tooltip={label}>
      {children}
    </span>
  );
}

export function Popover({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <details className="ui-popover">
      <summary>{trigger}</summary>
      <div className="ui-popover-content">{children}</div>
    </details>
  );
}

export function DropdownMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="ui-dropdown">
      <summary>{label}</summary>
      <div className="ui-dropdown-content">{children}</div>
    </details>
  );
}

export function Drawer({
  title,
  open = true,
  children,
}: {
  title: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <aside className={cx("ui-drawer", open && "is-open")} aria-label={title}>
      <div className="ui-drawer-header">
        <h2>{title}</h2>
      </div>
      {children}
    </aside>
  );
}

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }
  return (
    <div className="ui-modal-backdrop" role="presentation">
      <section aria-modal="true" className="ui-modal" role="dialog" aria-label={title}>
        <div className="ui-modal-header">
          <h2>{title}</h2>
          {onClose ? (
            <button className="ui-message-close" type="button" aria-label={`Close ${title}`} onClick={onClose}>
              x
            </button>
          ) : null}
        </div>
        {children}
      </section>
    </div>
  );
}

export function Toast({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={cx("ui-toast", `ui-tone-${tone}`)} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ui-skeleton" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-empty-state">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-error-state" role="alert">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
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
    return <EmptyState title={emptyLabel}>This table will update when matching records are available.</EmptyState>;
  }

  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
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

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav className="ui-pagination" aria-label="Pagination">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">
        Previous
      </Button>
      <span>
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} type="button">
        Next
      </Button>
    </nav>
  );
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div className="ui-date-range">
      <label>
        From
        <Input type="date" value={from} onChange={(event) => onFromChange(event.target.value)} />
      </label>
      <label>
        To
        <Input type="date" value={to} onChange={(event) => onToChange(event.target.value)} />
      </label>
    </div>
  );
}

export function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="ui-chart-card">
      <SectionHeader title={title} description={description} />
      {children}
    </Card>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="ui-section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ui-section-actions">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="ui-page-header">
      <div>
        {eyebrow ? <p className="ui-page-kicker">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ui-page-actions">{actions}</div> : null}
    </section>
  );
}
