import { Link } from "react-router-dom";

import { Alert } from "../../components/Feedback";
import { AuthLayout } from "./AuthLayout";

export function ProviderRegistrationPage() {
  return (
    <AuthLayout
      title="Register a provider workspace"
      subtitle="Prepare a provider connection for catalog sync, status lookups, reservations, usage analytics, and B2B billing."
    >
      <div className="auth-panel-header">
        <div>
          <p className="eyebrow">Provider onboarding</p>
          <h2>Integration requirements</h2>
        </div>
        <span className="auth-status-pill">API metadata</span>
      </div>
      <div className="provider-registration-list">
        <div>
          <strong>Provider code</strong>
          <span>Use one of the accepted provider codes: redPlug, greenPlug, or bluePlug.</span>
        </div>
        <div>
          <strong>API base URL</strong>
          <span>Provider endpoints are configured through provider-registry and never called directly by the browser.</span>
        </div>
        <div>
          <strong>Secret handling</strong>
          <span>API keys stay in the private runtime environment and are not stored in frontend code.</span>
        </div>
      </div>
      <Alert title="Local demo flow">
        Provider registration is an operator-only workflow. Provider admins can review their own configured workspace after an operator creates or updates the provider record.
      </Alert>
      <div className="button-row">
        <Link className="button-primary button-link" to="/operator/providers">Manage providers</Link>
        <Link className="button-secondary button-link" to="/operator/dashboard">Back to operator dashboard</Link>
      </div>
    </AuthLayout>
  );
}
