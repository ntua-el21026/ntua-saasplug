import type { ReactNode } from "react";

import { AuthLayoutFrame, BrandLockup } from "../../components/layout";
import evChargingMapHero from "../../assets/auth/ev-charging-map-hero.png";

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
        <div className="auth-showcase" aria-label="EV charging map preview">
          <img
            className="auth-showcase-map"
            src={evChargingMapHero}
            alt="Map of nearby EV charging points in Athens"
          />
          <div className="auth-showcase-copy">
            <strong>Power your drive, wherever the road takes you.</strong>
            <span>Find nearby chargers, check live availability, and reserve your next stop in seconds.</span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        {children}
      </section>
    </AuthLayoutFrame>
  );
}
