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
        <div className="auth-hero-copy">
          <Link to="/" className="auth-brand" aria-label="saasPlug home">
            <span className="brand-mark">sP</span>
            <span>
              <strong>saasPlug</strong>
              <small>Charging access platform</small>
            </span>
          </Link>
          <p className="eyebrow">Unified charging access</p>
          <h1 id="auth-title">{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="auth-showcase" aria-label="Platform overview">
          <div>
            <strong>3</strong>
            <span>charging networks</span>
          </div>
          <div>
            <strong>Live</strong>
            <span>availability checks</span>
          </div>
          <div>
            <strong>Instant</strong>
            <span>reservation handoff</span>
          </div>
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
