import { GenericStatusBadge } from "./domain/status";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return <GenericStatusBadge status={status} />;
}
