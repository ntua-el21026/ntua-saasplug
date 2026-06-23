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

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  const number = finiteNumber(value);
  if (number === null || number < 0) {
    return "Price unavailable";
  }
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatCostPerKwh(value: number | null | undefined): string {
  const number = finiteNumber(value);
  if (number === null || number < 0) {
    return "Cost/kWh unavailable";
  }
  return `${new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(number)}/kWh`;
}

export function formatMoney(value: number | null | undefined, currency: string | null | undefined = "EUR"): string {
  const number = finiteNumber(value);
  if (number === null) {
    return "Not available";
  }
  const safeCurrency = currency && /^[A-Z]{3}$/.test(currency) ? currency : "EUR";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatNumber(value: number | null | undefined): string {
  const number = finiteNumber(value);
  if (number === null) {
    return "Not available";
  }
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatPercent(value: number | null | undefined): string {
  const number = finiteNumber(value);
  if (number === null) {
    return "Not available";
  }
  return new Intl.NumberFormat("en", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(number);
}

export function formatCapacity(value: number | null | undefined): string {
  const number = finiteNumber(value);
  if (number === null || number <= 0) {
    return "Capacity unavailable";
  }
  return `${number} kW`;
}

export function formatDurationMinutes(value: number | null | undefined): string {
  const number = finiteNumber(value);
  if (number === null || number < 0) {
    return "Not available";
  }
  if (number === 0) {
    return "0 min";
  }
  if (number % 60 === 0) {
    const hours = number / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  if (number > 60) {
    const hours = Math.floor(number / 60);
    const minutes = number % 60;
    return `${hours}h ${minutes}m`;
  }
  return `${number} min`;
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
