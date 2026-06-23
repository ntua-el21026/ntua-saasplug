import { StatusBadge as UiStatusBadge, type Tone } from "../../ui";
import { statusLabel } from "../../../lib/formatting";

export function statusToneFor(value: string | null | undefined): Tone {
  switch (value) {
    case "available":
    case "succeeded":
    case "completed":
    case "paid":
    case "healthy":
    case "active":
      return "success";
    case "charging":
    case "reserved":
    case "issued":
    case "draft":
    case "pending":
      return "warning";
    case "malfunction":
    case "offline":
    case "failed":
    case "overdue":
    case "unavailable":
      return "danger";
    case "unknown":
      return "info";
    default:
      return "neutral";
  }
}

export function GenericStatusBadge({ status }: { status: string | null | undefined }) {
  return <UiStatusBadge tone={statusToneFor(status)}>{statusLabel(status)}</UiStatusBadge>;
}

export function ChargingPointStatusBadge({ status }: { status: string | null | undefined }) {
  return <GenericStatusBadge status={status} />;
}

export function SyncRunStatusBadge({ status }: { status: string | null | undefined }) {
  return <GenericStatusBadge status={status} />;
}
