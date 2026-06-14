import type { ReactNode } from "react";

import { AuthLayoutFrame, BrandLockup } from "../../components/layout";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <AuthLayoutFrame>
      <section className="auth-hero" aria-labelledby="auth-title">
        <div className="auth-hero-copy">
          <BrandLockup />
          <h1 id="auth-title">{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="auth-showcase" aria-label="Platform preview">
          <div className="auth-showcase-map">
            <span className="mock-road mock-road-a" />
            <span className="mock-road mock-road-b" />
            <span className="mock-marker mock-marker-energy" />
            <span className="mock-marker mock-marker-warning" />
            <span className="mock-marker mock-marker-selected" />
          </div>
          <div className="auth-showcase-copy">
            <strong>Gateway-only SaaS cockpit</strong>
            <span>Catalog, reservations, analytics, invoices, and sync controls in one role-aware frontend.</span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        {children}
      </section>
    </AuthLayoutFrame>
  );
}
