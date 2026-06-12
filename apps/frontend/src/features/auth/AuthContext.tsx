import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, requestJson } from "../../lib/api";
import { clearStoredSession, readStoredSession, type StoredSession, writeStoredSession } from "../../lib/storage";
import type { AuthTokenResponse, GoogleOAuthStatus, User } from "../../lib/types";

interface AuthContextValue {
  session: StoredSession | null;
  bootstrapping: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<StoredSession | null>;
  googleStatus: () => Promise<GoogleOAuthStatus>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readStoredSession());
  const [bootstrapping, setBootstrapping] = useState(true);

  const persistTokenResponse = useCallback((payload: AuthTokenResponse): StoredSession => {
    const nextSession: StoredSession = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + payload.expires_in * 1000,
      user: payload.user,
    };
    writeStoredSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, []);

  const clearSession = useCallback(() => {
    clearStoredSession();
    setSession(null);
  }, []);

  const refreshSession = useCallback(async (): Promise<StoredSession | null> => {
    const current = readStoredSession();
    if (!current?.refreshToken) {
      clearSession();
      return null;
    }
    try {
      const refreshed = await requestJson<AuthTokenResponse>("/api/auth/auth/refresh", {
        method: "POST",
        bodyJson: { refresh_token: current.refreshToken },
      });
      return persistTokenResponse(refreshed);
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession, persistTokenResponse]);

  useEffect(() => {
    let cancelled = false;

    async function validateStoredSession() {
      const current = readStoredSession();
      if (!current) {
        if (!cancelled) {
          setBootstrapping(false);
        }
        return;
      }

      try {
        const user = await requestJson<User>("/api/auth/auth/me", {
          accessToken: current.accessToken,
        });
        const nextSession = { ...current, user };
        writeStoredSession(nextSession);
        if (!cancelled) {
          setSession(nextSession);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await refreshSession();
        } else {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    validateStoredSession();

    return () => {
      cancelled = true;
    };
  }, [clearSession, refreshSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const payload = await requestJson<AuthTokenResponse>("/api/auth/auth/login", {
        method: "POST",
        bodyJson: { email, password },
      });
      persistTokenResponse(payload);
    },
    [persistTokenResponse],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const payload = await requestJson<AuthTokenResponse>("/api/auth/auth/register", {
        method: "POST",
        bodyJson: { email, password },
      });
      persistTokenResponse(payload);
    },
    [persistTokenResponse],
  );

  const signOut = useCallback(async () => {
    const current = readStoredSession();
    clearSession();
    if (!current?.refreshToken) {
      return;
    }
    try {
      await requestJson<{ status: string }>("/api/auth/auth/logout", {
        method: "POST",
        bodyJson: { refresh_token: current.refreshToken },
      });
    } catch {
      return;
    }
  }, [clearSession]);

  const googleStatus = useCallback(() => requestJson<GoogleOAuthStatus>("/api/auth/auth/google/login"), []);

  const value = useMemo(
    () => ({
      session,
      bootstrapping,
      signIn,
      register,
      signOut,
      refreshSession,
      googleStatus,
    }),
    [bootstrapping, googleStatus, refreshSession, register, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
