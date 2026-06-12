import type { ReactNode } from "react";
import { Link } from "react-router-dom";

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
    <main className="auth-page">
      <section className="auth-hero" aria-labelledby="auth-title">
        <div>
          <p className="eyebrow">saasPlug EV access</p>
          <h1 id="auth-title">{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="auth-proof" aria-label="Demo route coverage">
          <span>Gateway-only API calls</span>
          <span>Viewport catalog search</span>
          <span>Status cache lookup</span>
          <span>Synchronous reservation flow</span>
        </div>
      </section>
      <section className="auth-panel">
        {children}
        <p className="auth-switch">
          <Link to="/login">Sign in</Link>
          <span aria-hidden="true">/</span>
          <Link to="/register">Create EV account</Link>
        </p>
      </section>
    </main>
  );
}
