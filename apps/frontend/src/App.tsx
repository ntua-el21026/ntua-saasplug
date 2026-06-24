import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AccessDenied } from "./components/AccessDenied";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { GoogleCallbackPage } from "./features/auth/GoogleCallbackPage";
import { LoginPage } from "./features/auth/LoginPage";
import { LogoutPage } from "./features/auth/LogoutPage";
import { ProviderRegistrationPage } from "./features/auth/ProviderRegistrationPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { LandingPage } from "./features/landing/LandingPage";
import type { Role } from "./lib/types";

const ProfilePage = lazy(() => import("./features/auth/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const CatalogPage = lazy(() => import("./features/catalog/CatalogPage").then((module) => ({ default: module.CatalogPage })));
const PointDetailPage = lazy(() => import("./features/catalog/PointDetailPage").then((module) => ({ default: module.PointDetailPage })));
const ReservationsPage = lazy(() => import("./features/reservations/ReservationsPage").then((module) => ({ default: module.ReservationsPage })));
const OperatorAnalyticsPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.OperatorAnalyticsPage })));
const OperatorCatalogPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.OperatorCatalogPage })));
const OperatorDashboardPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.OperatorDashboardPage })));
const OperatorInvoicesPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.OperatorInvoicesPage })));
const OperatorIssueInvoicePage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.OperatorIssueInvoicePage })));
const OperatorPricingPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.OperatorPricingPage })));
const OperatorProvidersPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.OperatorProvidersPage })));
const OperatorSyncPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.OperatorSyncPage })));
const OperatorSystemPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.OperatorSystemPage })));
const ProviderAnalyticsPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.ProviderAnalyticsPage })));
const ProviderDashboardPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.ProviderDashboardPage })));
const ProviderExportPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.ProviderExportPage })));
const ProviderInvoiceDetailPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.ProviderInvoiceDetailPage })));
const ProviderInvoicesPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.ProviderInvoicesPage })));
const ProviderPointsPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.ProviderPointsPage })));
const ProviderSettingsPage = lazy(() => import("./features/admin/AdminPages").then((module) => ({ default: module.ProviderSettingsPage })));

function HomeRedirect() {
  const { session, bootstrapping } = useAuth();

  if (bootstrapping) {
    return <div className="page-loader">Loading saasPlug...</div>;
  }

  if (!session) {
    return <LandingPage />;
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
        <Suspense fallback={<div className="page-loader">Loading page...</div>}>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/auth" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/google/callback" element={<GoogleCallbackPage />} />
            <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/provider-register"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OPERATOR"]}>
                  <ProviderRegistrationPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
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
                <RoleRoute allowedRoles={["EV_USER", "PROVIDER_ADMIN", "OPERATOR"]}>
                  <PointDetailPage />
                </RoleRoute>
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
