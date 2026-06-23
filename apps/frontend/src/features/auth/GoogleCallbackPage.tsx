import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AppShell } from "../../components/AppShell";
import { Alert } from "../../components/Feedback";
import { messageFromUnknownError } from "../../lib/api";
import { useAuth } from "./AuthContext";

export function GoogleCallbackPage() {
  const { completeGoogleSignIn } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finishGoogleSignIn() {
      const googleError = searchParams.get("error");
      if (googleError) {
        setErrorMessage("Google sign-in was not completed. Please try again.");
        return;
      }

      const code = searchParams.get("code");
      if (!code) {
        setErrorMessage("Google did not return the sign-in confirmation. Please try again.");
        return;
      }

      try {
        await completeGoogleSignIn(code);
        if (!cancelled) {
          navigate("/", { replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(messageFromUnknownError(error));
        }
      }
    }

    finishGoogleSignIn();

    return () => {
      cancelled = true;
    };
  }, [completeGoogleSignIn, navigate, searchParams]);

  return (
    <AppShell>
      <main className="login-page">
        <section className="login-panel">
          <div className="auth-card">
            <p className="eyebrow">Google sign-in</p>
            <h1>{errorMessage ? "Sign-in needs attention" : "Completing your sign-in"}</h1>
            {errorMessage ? (
              <>
                <Alert tone="danger">{errorMessage}</Alert>
                <Link className="button-primary button-link" to="/login">
                  Back to sign in
                </Link>
              </>
            ) : (
              <p className="muted">Please wait while we connect your account.</p>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
