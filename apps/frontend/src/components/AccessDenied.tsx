import { AppShell } from "./AppShell";

export function AccessDenied() {
  return (
    <AppShell>
      <main className="page page-narrow">
        <section className="page-heading">
          <h1>Access denied</h1>
          <p>Your account role does not have access to this workspace.</p>
        </section>
      </main>
    </AppShell>
  );
}
