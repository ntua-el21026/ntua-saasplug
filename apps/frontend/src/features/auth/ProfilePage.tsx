import { AppShell } from "../../components/AppShell";
import { Alert } from "../../components/Feedback";
import { useAuth } from "./AuthContext";

export function ProfilePage() {
  const { session } = useAuth();
  const user = session?.user;
  const isEvUser = user?.roles.includes("EV_USER");

  return (
    <AppShell>
      <main className="page page-narrow">
        <section className="page-heading">
          <p className="eyebrow">Profile</p>
          <h1>Session and demo access</h1>
          <p>Frontend state is local to this browser and uses the existing auth-service JWT and refresh-token endpoints.</p>
        </section>

        {!isEvUser ? (
          <Alert tone="warning" title="Role area deferred">
            Provider administrator and operator dashboards are intentionally reserved for Prompt 13. This run implements
            the EV user experience only.
          </Alert>
        ) : null}

        <section className="profile-grid">
          <div className="surface">
            <h2>Current user</h2>
            <dl className="detail-list">
              <div>
                <dt>Email</dt>
                <dd>{user?.email}</dd>
              </div>
              <div>
                <dt>Roles</dt>
                <dd>{user?.roles.join(", ")}</dd>
              </div>
              <div>
                <dt>Provider scope</dt>
                <dd>{user?.provider_code ?? "None"}</dd>
              </div>
            </dl>
          </div>
          <div className="surface">
            <h2>Local demo accounts</h2>
            <dl className="detail-list">
              <div>
                <dt>Password</dt>
                <dd>change-me-demo-password</dd>
              </div>
              <div>
                <dt>EV user</dt>
                <dd>evuser@saasplug.local</dd>
              </div>
              <div>
                <dt>Operator</dt>
                <dd>operator@saasplug.local</dd>
              </div>
              <div>
                <dt>Provider admins</dt>
                <dd>red-admin@saasplug.local, green-admin@saasplug.local, blue-admin@saasplug.local</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
