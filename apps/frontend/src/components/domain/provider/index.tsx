import { Badge } from "../../ui";
import { providerLabel } from "../../../lib/formatting";
import type { ProviderCode } from "../../../lib/types";

export function ProviderBadge({ providerCode }: { providerCode: ProviderCode | string }) {
  return <Badge tone="info">{providerLabel(providerCode)}</Badge>;
}

export function ProviderHealthBadge({
  ok,
  label,
}: {
  ok: boolean;
  label?: string;
}) {
  return <Badge tone={ok ? "success" : "danger"}>{label ?? (ok ? "Healthy" : "Unavailable")}</Badge>;
}
