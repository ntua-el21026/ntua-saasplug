import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "../../components/AppShell";
import { Alert } from "../../components/Feedback";
import { Modal } from "../../components/ui";
import { messageFromUnknownError } from "../../lib/api";
import { useAuth } from "./AuthContext";

export function LogoutPage() {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      navigate("/login", { replace: true });
    }
  }, [navigate, session]);

  const cancelSignOut = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(defaultWorkspacePath(session?.user.roles ?? []), { replace: true });
  };

  const confirmSignOut = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <main className="page">
        <Modal title="Sign out?" open={Boolean(session)}>
          <p className="muted">You are about to leave your saasPlug workspace. You can sign in again at any time.</p>
          {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
          <div className="button-row logout-confirmation-actions">
            <button className="button-secondary" type="button" onClick={cancelSignOut} disabled={submitting}>
              Cancel
            </button>
            <button className="button-primary" type="button" onClick={confirmSignOut} disabled={submitting}>
              {submitting ? "Signing out" : "Sign out"}
            </button>
          </div>
        </Modal>
      </main>
    </AppShell>
  );
}

function defaultWorkspacePath(roles: string[]): string {
  if (roles.includes("OPERATOR")) {
    return "/operator/dashboard";
  }
  if (roles.includes("PROVIDER_ADMIN")) {
    return "/provider/dashboard";
  }
  if (roles.includes("EV_USER")) {
    return "/map";
  }
  return "/";
}
