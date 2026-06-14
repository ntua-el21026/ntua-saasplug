import type { ReactNode } from "react";

import { EmptyState as UiEmptyState, ErrorState, Toast } from "./ui";

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
}) {
  return <Toast tone={tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "danger" ? "danger" : "info"}>{title ? <strong>{title}</strong> : null}<div>{children}</div></Toast>;
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
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
  return <UiEmptyState title={title}>{children}</UiEmptyState>;
}

export function ErrorBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return <ErrorState title={title}>{children}</ErrorState>;
}
