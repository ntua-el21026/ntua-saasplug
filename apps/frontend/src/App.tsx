import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { LogoutPage } from "./features/auth/LogoutPage";
import { ProfilePage } from "./features/auth/ProfilePage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { CatalogPage } from "./features/catalog/CatalogPage";
import { PointDetailPage } from "./features/catalog/PointDetailPage";
import { ReservationsPage } from "./features/reservations/ReservationsPage";

function HomeRedirect() {
  const { session, bootstrapping } = useAuth();

  if (bootstrapping) {
    return <div className="page-loader">Loading saasPlug...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.user.roles.includes("EV_USER")) {
    return <Navigate to="/map" replace />;
  }

  return <Navigate to="/profile" replace />;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, bootstrapping } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return <div className="page-loader">Loading session...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function EvOnlyRoute({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  if (!session?.user.roles.includes("EV_USER")) {
    return (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/logout" element={<LogoutPage />} />
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <EvOnlyRoute>
                  <CatalogPage />
                </EvOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <EvOnlyRoute>
                  <CatalogPage />
                </EvOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/points/:providerCode/:externalPointId"
            element={
              <ProtectedRoute>
                <EvOnlyRoute>
                  <PointDetailPage />
                </EvOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reservations"
            element={
              <ProtectedRoute>
                <EvOnlyRoute>
                  <ReservationsPage />
                </EvOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
