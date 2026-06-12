import { statusLabel, statusTone } from "../lib/formatting";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return <span className={`status-badge status-${statusTone(status)}`}>{statusLabel(status)}</span>;
}
