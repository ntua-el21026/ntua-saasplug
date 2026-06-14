import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Alert } from "../../components/Feedback";
import { messageFromUnknownError } from "../../lib/api";
import { useAuth } from "./AuthContext";
import { AuthLayout } from "./AuthLayout";

const DEMO_PASSWORD = import.meta.env.DEMO_USER_PASSWORD
  ?? import.meta.env.VITE_DEMO_USER_PASSWORD
  ?? "change-me-demo-password";

const DEMO_ACCOUNTS = [
  {
    label: "EV user",
    email: "evuser@saasplug.local",
    description: "Search and reserve chargers",
    password: import.meta.env.VITE_DEMO_EV_USER_PASSWORD ?? DEMO_PASSWORD,
  },
  {
    label: "Operator",
    email: "operator@saasplug.local",
    description: "Manage platform operations",
    password: import.meta.env.VITE_DEMO_OPERATOR_PASSWORD ?? DEMO_PASSWORD,
  },
  {
    label: "redPlug admin",
    email: "red-admin@saasplug.local",
    description: "Review provider activity",
    password: import.meta.env.VITE_DEMO_RED_ADMIN_PASSWORD ?? DEMO_PASSWORD,
  },
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, googleStatus } = useAuth();
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState(DEMO_ACCOUNTS[0].password);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await signIn(email, password);
      const redirect = typeof location.state === "object" && location.state && "from" in location.state
        ? String(location.state.from)
        : "/";
      navigate(redirect, { replace: true });
    } catch (caught) {
      setError(messageFromUnknownError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function useGoogleHook() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const status = await googleStatus();
      if (status.configured && status.authorization_url) {
        window.location.assign(status.authorization_url);
        return;
      }
      setMessage(status.message);
    } catch (caught) {
      setError(messageFromUnknownError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in to saasPlug"
      subtitle="Access charging availability, reservations, provider operations, and platform controls from one secure workspace."
    >
      <div className="auth-panel-header">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h2>Continue to your workspace</h2>
        </div>
      </div>
      <form className="form-stack" onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <span className="password-field">
            <input
              type={passwordVisible ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              className="password-toggle"
              onClick={() => setPasswordVisible((current) => !current)}
              title={passwordVisible ? "Hide password" : "Show password"}
              type="button"
            >
              <span aria-hidden="true" className={`password-eye ${passwordVisible ? "is-visible" : ""}`}>
                <span />
              </span>
            </button>
          </span>
        </label>
        <div className="button-row">
          <button className="button-primary" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
          <button className="button-secondary" type="button" onClick={useGoogleHook} disabled={submitting}>
            Continue with Google
          </button>
        </div>
      </form>

      <Link className="button-secondary auth-register-action" to="/register">
        Create EV account
      </Link>

      <div className="demo-accounts" aria-label="Account shortcuts">
        <p>Try a role</p>
        {DEMO_ACCOUNTS.map((account) => (
          <button
            className={email === account.email ? "is-selected" : undefined}
            type="button"
            key={account.email}
            onClick={() => {
              setEmail(account.email);
              setPassword(account.password);
            }}
          >
            <span>{account.label}</span>
            <small>{account.description}</small>
          </button>
        ))}
      </div>

      {message ? <Alert title="Google OAuth local mode">{message}</Alert> : null}
      {error ? (
        <Alert tone="danger" title="Sign-in failed">
          {error}
        </Alert>
      ) : null}
    </AuthLayout>
  );
}
