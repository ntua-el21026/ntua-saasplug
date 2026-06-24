import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import { AppShell } from "../../components/AppShell";
import { Alert } from "../../components/Feedback";
import { messageFromUnknownError } from "../../lib/api";
import { providerAdminLabel } from "../../lib/formatting";
import { useAuth } from "./AuthContext";

export function ProfilePage() {
  const { changePassword, session } = useAuth();
  const user = session?.user;
  const primaryRole = user?.roles[0] ?? "EV_USER";
  const providerScope = user?.provider_code ?? "All networks";
  const workspaceLink = getWorkspaceLink(primaryRole);
  const workspaceLabel = getWorkspaceLabel(primaryRole);
  const profileCopy = getProfileCopy(primaryRole);
  const isGooglePasswordAccount = user?.auth_provider === "google" || user?.last_login_method === "google";
  const canChangePassword = Boolean(user)
    && user?.password_change_supported !== false
    && !isGooglePasswordAccount;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function onChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setPasswordSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Your password has been updated. Sign in again to continue.");
    } catch (caught) {
      setPasswordError(messageFromUnknownError(caught));
    } finally {
      setPasswordSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="page account-page">
        <section className="account-hero surface">
          <div className="account-avatar" aria-hidden="true">
            {getInitials(user?.email)}
          </div>
          <div>
            <h1>{user?.email}</h1>
            <p>{profileCopy.hero}</p>
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
                <p>{profileCopy.details}</p>
              </div>
            </div>
            <dl className="detail-list account-detail-list">
              <div>
                <dt>Email</dt>
                <dd>{user?.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{formatRole(primaryRole, user?.provider_code)}</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>{workspaceLabel}</dd>
              </div>
              <div>
                <dt>Provider access</dt>
                <dd>{formatProviderScope(primaryRole, providerScope)}</dd>
              </div>
              <div>
                <dt>Sign-in</dt>
                <dd>{user?.last_login_method === "google" ? "Google" : "Email and password"}</dd>
              </div>
            </dl>
          </div>
          <div className="surface">
            <div className="surface-header">
              <div>
                <h2>Access summary</h2>
                <p>{profileCopy.access}</p>
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
          {canChangePassword ? (
            <div className="surface account-security-card">
              <div className="surface-header">
                <div>
                  <h2>Password</h2>
                  <p>Update the password you use when signing in with your email address.</p>
                </div>
              </div>
              <form className="form-stack account-password-form" onSubmit={onChangePassword}>
                <label>
                  Current password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </label>
                <label>
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </label>
                <button className="button-primary" type="submit" disabled={passwordSubmitting}>
                  {passwordSubmitting ? "Updating..." : "Update password"}
                </button>
              </form>
              {passwordMessage ? <Alert title="Password updated">{passwordMessage}</Alert> : null}
              {passwordError ? (
                <Alert tone="danger" title="Password not updated">
                  {passwordError}
                </Alert>
              ) : null}
            </div>
          ) : null}
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
    return "operator workspace";
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

function formatRole(role: string, providerCode?: string | null): string {
  if (role === "OPERATOR") {
    return "Operator";
  }
  if (role === "PROVIDER_ADMIN") {
    return providerAdminLabel(providerCode);
  }
  return "EV user";
}

function formatProviderScope(role: string, providerScope: string): string {
  if (role === "PROVIDER_ADMIN") {
    return providerScope;
  }
  if (role === "OPERATOR") {
    return "All providers";
  }
  return "No provider workspace";
}

function getProfileCopy(role: string): { hero: string; details: string; access: string } {
  if (role === "OPERATOR") {
    return {
      hero: "Keep your operator account ready for platform reviews, provider oversight, and billing work.",
      details: "These details identify the account you use to supervise saasPlug operations.",
      access: "Open the operational areas you use most often.",
    };
  }
  if (role === "PROVIDER_ADMIN") {
    return {
      hero: "Keep your provider account ready for catalog reviews, analytics, invoices, and settings.",
      details: "These details identify the account connected to your provider workspace.",
      access: "Open the provider tools you use to manage your charging network.",
    };
  }
  return {
    hero: "Keep your EV account ready for charger search, reservations, and trip planning.",
    details: "These details identify your charging account when you search and reserve chargers.",
    access: "Return to the charging tasks you use most often.",
  };
}

function getActions(role: string): Array<{ title: string; description: string; href: string }> {
  if (role === "OPERATOR") {
    return [
      { title: "Review platform health", description: "Check platform availability, scheduled work, and data freshness.", href: "/operator/system" },
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
