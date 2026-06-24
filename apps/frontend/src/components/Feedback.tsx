import { useEffect, useState, type ReactNode } from "react";

import { EmptyState as UiEmptyState, ErrorState, Toast } from "./ui";

export function Alert({
  tone = "info",
  title,
  children,
  dismissible = true,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [tone, title, children]);

  if (!visible) {
    return null;
  }

  return (
    <Toast tone={tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "danger" ? "danger" : "info"}>
      <div className="ui-toast-content">
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
      {dismissible ? (
        <button className="ui-message-close" type="button" aria-label={title ? `Close ${title}` : "Close message"} onClick={() => setVisible(false)}>
          x
        </button>
      ) : null}
    </Toast>
  );
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
