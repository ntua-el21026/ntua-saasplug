import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Alert } from "../../components/Feedback";
import { messageFromUnknownError } from "../../lib/api";
import { useAuth } from "./AuthContext";
import { AuthLayout } from "./AuthLayout";

const DEMO_PASSWORD = "change-me-demo-password";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, googleStatus } = useAuth();
  const [email, setEmail] = useState("evuser@saasplug.local");
  const [password, setPassword] = useState(DEMO_PASSWORD);
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
      title="Find and reserve EV charging points"
      subtitle="Sign in to search the aggregated catalog, check charger status, and reserve through saasPlug."
    >
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
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <div className="button-row">
          <button className="button-primary" type="submit" disabled={submitting}>
            Sign in
          </button>
          <button className="button-secondary" type="button" onClick={useGoogleHook} disabled={submitting}>
            Google OAuth
          </button>
        </div>
      </form>

      <div className="demo-accounts" aria-label="Demo accounts">
        <button type="button" onClick={() => setEmail("evuser@saasplug.local")}>
          EV user
        </button>
        <button type="button" onClick={() => setEmail("operator@saasplug.local")}>
          Operator
        </button>
        <button type="button" onClick={() => setEmail("red-admin@saasplug.local")}>
          redPlug admin
        </button>
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
