import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AccessDenied } from "./components/AccessDenied";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { LogoutPage } from "./features/auth/LogoutPage";
import { ProfilePage } from "./features/auth/ProfilePage";
import { RegisterPage } from "./features/auth/RegisterPage";
import {
  OperatorAnalyticsPage,
  OperatorCatalogPage,
  OperatorDashboardPage,
  OperatorInvoicesPage,
  OperatorIssueInvoicePage,
  OperatorPricingPage,
  OperatorProvidersPage,
  OperatorSyncPage,
  OperatorSystemPage,
  ProviderAnalyticsPage,
  ProviderDashboardPage,
  ProviderExportPage,
  ProviderInvoiceDetailPage,
  ProviderInvoicesPage,
  ProviderPointsPage,
  ProviderSettingsPage,
} from "./features/admin/AdminPages";
import { CatalogPage } from "./features/catalog/CatalogPage";
import { PointDetailPage } from "./features/catalog/PointDetailPage";
import { ReservationsPage } from "./features/reservations/ReservationsPage";
import type { Role } from "./lib/types";

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

  if (session.user.roles.includes("PROVIDER_ADMIN")) {
    return <Navigate to="/provider/dashboard" replace />;
  }

  if (session.user.roles.includes("OPERATOR")) {
    return <Navigate to="/operator/dashboard" replace />;
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
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function RoleRoute({ allowedRoles, children }: { allowedRoles: Role[]; children: ReactNode }) {
  const { session } = useAuth();

  if (!session || !allowedRoles.some((role) => session.user.roles.includes(role))) {
    return <AccessDenied />;
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
          <Route
            path="/provider/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["PROVIDER_ADMIN"]}>
                  <ProviderDashboardPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/provider/points"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["PROVIDER_ADMIN"]}>
                  <ProviderPointsPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/provider/analytics"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["PROVIDER_ADMIN"]}>
                  <ProviderAnalyticsPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/provider/invoices"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["PROVIDER_ADMIN"]}>
                  <ProviderInvoicesPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/provider/invoices/:invoiceId"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["PROVIDER_ADMIN", "OPERATOR"]}>
                  <ProviderInvoiceDetailPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/provider/export"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["PROVIDER_ADMIN"]}>
                  <ProviderExportPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/provider/settings"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["PROVIDER_ADMIN"]}>
                  <ProviderSettingsPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/dashboard"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <OperatorDashboardPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/providers"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <OperatorProvidersPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/analytics"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <OperatorAnalyticsPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/catalog"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <OperatorCatalogPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/invoices"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <OperatorInvoicesPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/invoices/new"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <OperatorIssueInvoicePage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/invoices/:invoiceId"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <ProviderInvoiceDetailPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/pricing"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <OperatorPricingPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/sync"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <OperatorSyncPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/system"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <OperatorSystemPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
