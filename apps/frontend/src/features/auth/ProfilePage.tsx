import { Link } from "react-router-dom";

import { AppShell } from "../../components/AppShell";
import { useAuth } from "./AuthContext";

export function ProfilePage() {
  const { session } = useAuth();
  const user = session?.user;
  const primaryRole = user?.roles[0] ?? "EV_USER";
  const providerScope = user?.provider_code ?? "All networks";
  const workspaceLink = getWorkspaceLink(primaryRole);
  const workspaceLabel = getWorkspaceLabel(primaryRole);

  return (
    <AppShell>
      <main className="page account-page">
        <section className="account-hero surface">
          <div className="account-avatar" aria-hidden="true">
            {getInitials(user?.email)}
          </div>
          <div>
            <p className="eyebrow">Account</p>
            <h1>{user?.email}</h1>
            <p>Manage your saasPlug identity, workspace access, and provider scope.</p>
          </div>
          <Link className="button-primary button-link" to={workspaceLink}>
            Open {workspaceLabel}
          </Link>
        </section>

        <section className="account-grid">
          <div className="surface">
            <div className="surface-header">
              <div>
                <h2>Profile details</h2>
                <p>Your signed-in identity and access level.</p>
              </div>
            </div>
            <dl className="detail-list account-detail-list">
              <div>
                <dt>Email</dt>
                <dd>{user?.email}</dd>
              </div>
              <div>
                <dt>Roles</dt>
                <dd>{user?.roles.join(", ")}</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>{workspaceLabel}</dd>
              </div>
              <div>
                <dt>Provider access</dt>
                <dd>{providerScope}</dd>
              </div>
            </dl>
          </div>
          <div className="surface">
            <div className="surface-header">
              <div>
                <h2>Access summary</h2>
                <p>Role-aware entry points for your current session.</p>
              </div>
            </div>
            <div className="account-action-list">
              {getActions(primaryRole).map((action) => (
                <Link to={action.href} key={action.href} className="account-action">
                  <span>
                    <strong>{action.title}</strong>
                    <small>{action.description}</small>
                  </span>
                  <span aria-hidden="true">Open</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function getWorkspaceLink(role: string): string {
  if (role === "OPERATOR") {
    return "/operator/dashboard";
  }
  if (role === "PROVIDER_ADMIN") {
    return "/provider/dashboard";
  }
  return "/map";
}

function getWorkspaceLabel(role: string): string {
  if (role === "OPERATOR") {
    return "operator console";
  }
  if (role === "PROVIDER_ADMIN") {
    return "provider workspace";
  }
  return "charging map";
}

function getInitials(email?: string): string {
  if (!email) {
    return "SP";
  }
  return email.slice(0, 2).toUpperCase();
}

function getActions(role: string): Array<{ title: string; description: string; href: string }> {
  if (role === "OPERATOR") {
    return [
      { title: "Review platform health", description: "Check services, scheduler, and data freshness.", href: "/operator/system" },
      { title: "Manage providers", description: "Open provider registry and activation controls.", href: "/operator/providers" },
      { title: "Issue invoices", description: "Create provider invoices from prepared charges.", href: "/operator/invoices" },
    ];
  }

  if (role === "PROVIDER_ADMIN") {
    return [
      { title: "View provider dashboard", description: "Track reservations, usage, and billing posture.", href: "/provider/dashboard" },
      { title: "Inspect charging points", description: "Review provider-scoped point availability.", href: "/provider/points" },
      { title: "Open invoices", description: "Review issued invoices and payment status.", href: "/provider/invoices" },
    ];
  }

  return [
    { title: "Find a charger", description: "Search available charging points near your route.", href: "/map" },
    { title: "View reservations", description: "Review your current and previous reservations.", href: "/reservations" },
    { title: "Continue browsing", description: "Return to the charging catalog.", href: "/dashboard" },
  ];
}
