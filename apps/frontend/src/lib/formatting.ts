import type { ProviderCode, StatusValue } from "./types";

export const PROVIDERS: ProviderCode[] = ["redPlug", "greenPlug", "bluePlug"];
export const STATUSES: StatusValue[] = ["available", "charging", "reserved", "malfunction", "offline", "unknown"];

export function providerLabel(providerCode: string): string {
  const labels: Record<string, string> = {
    redPlug: "redPlug",
    greenPlug: "greenPlug",
    bluePlug: "bluePlug",
  };
  return labels[providerCode] ?? providerCode;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Price unavailable";
  }
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCapacity(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Capacity unavailable";
  }
  return `${value} kW`;
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) {
    return "unknown";
  }
  return status.replace(/_/g, " ");
}

export function statusTone(status: string | null | undefined): string {
  switch (status) {
    case "available":
      return "good";
    case "charging":
      return "active";
    case "reserved":
      return "warn";
    case "malfunction":
    case "offline":
      return "bad";
    default:
      return "neutral";
  }
}
