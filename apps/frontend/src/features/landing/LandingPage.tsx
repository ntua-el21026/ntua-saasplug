import { Link } from "react-router-dom";

import { BrandLockup, MarketingLayout } from "../../components/layout";
import evChargingMapHero from "../../assets/auth/ev-charging-map-hero.png";

export function LandingPage() {
  return (
    <MarketingLayout>
      <header className="marketing-topbar">
        <BrandLockup />
        <nav aria-label="Entry">
          <Link to="/login">Sign in</Link>
          <Link className="button-primary button-link" to="/register">Create EV account</Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy landing-hero-card">
          <h1 id="landing-title">Charging, connected.</h1>
          <p>Find nearby chargers, check live availability, and reserve your next stop across connected networks.</p>
        </div>
        <figure className="landing-hero-visual">
          <img
            className="landing-hero-map"
            src={evChargingMapHero}
            alt="Map of nearby EV charging points in Athens"
          />
        </figure>
      </section>
    </MarketingLayout>
  );
}
