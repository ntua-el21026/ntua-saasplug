import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AppShell } from "../../components/AppShell";
import { Alert } from "../../components/Feedback";
import { messageFromUnknownError } from "../../lib/api";
import type { AuthTokenResponse } from "../../lib/types";
import { useAuth } from "./AuthContext";

export function GoogleCallbackPage() {
  const { completeGoogleRedirect, completeGoogleSignIn } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finishGoogleSignIn() {
      let fragmentPayload: AuthTokenResponse | null;
      try {
        fragmentPayload = readGoogleRedirectPayload();
      } catch {
        window.history.replaceState({}, "", "/login/google/callback");
        setErrorMessage("Google sign-in could not be completed. Please try again.");
        return;
      }

      if (fragmentPayload) {
        window.history.replaceState({}, "", "/login/google/callback");
        completeGoogleRedirect(fragmentPayload);
        if (!cancelled) {
          navigate("/", { replace: true });
        }
        return;
      }

      const fragmentError = readGoogleRedirectError();
      if (fragmentError) {
        window.history.replaceState({}, "", "/login/google/callback");
        setErrorMessage("Google sign-in was not completed. Please try again.");
        return;
      }

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
      const state = searchParams.get("state");
      if (!state) {
        setErrorMessage("Google did not return the sign-in state. Please try again.");
        return;
      }

      try {
        await completeGoogleSignIn(code, state);
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
  }, [completeGoogleRedirect, completeGoogleSignIn, navigate, searchParams]);

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

function readGoogleRedirectPayload(): AuthTokenResponse | null {
  const payload = new URLSearchParams(window.location.hash.slice(1)).get("payload");
  if (!payload) {
    return null;
  }
  const padding = "=".repeat((4 - (payload.length % 4)) % 4);
  const normalized = `${payload}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const parsed = JSON.parse(window.atob(normalized)) as Partial<AuthTokenResponse>;
  if (
    typeof parsed.access_token !== "string" ||
    typeof parsed.refresh_token !== "string" ||
    typeof parsed.expires_in !== "number" ||
    !parsed.user ||
    !Array.isArray(parsed.user.roles)
  ) {
    throw new Error("Invalid Google sign-in payload");
  }
  return parsed as AuthTokenResponse;
}

function readGoogleRedirectError(): string | null {
  return new URLSearchParams(window.location.hash.slice(1)).get("error");
}
