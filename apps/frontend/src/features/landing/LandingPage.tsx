import { Link } from "react-router-dom";

import { BrandLockup, MarketingLayout } from "../../components/layout";

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

      <section className="landing-hero">
        <div className="landing-copy">
          <h1>One network for every EV charging provider.</h1>
          <p>Find, compare, reserve, and manage charging points across connected providers.</p>
          <div className="button-row">
            <Link className="button-primary button-link" to="/login">Open workspace</Link>
            <Link className="button-secondary button-link" to="/register">Create EV account</Link>
          </div>
        </div>

        <div className="product-mockup" aria-label="saasPlug product preview">
          <div className="mockup-topline">
            <span>Infrastructure cockpit</span>
            <strong>Live Athens viewport</strong>
          </div>
          <div className="mockup-grid">
            <div className="mockup-map">
              <span className="mock-road mock-road-a" />
              <span className="mock-road mock-road-b" />
              <span className="mock-marker mock-marker-energy" />
              <span className="mock-marker mock-marker-warning" />
              <span className="mock-marker mock-marker-danger" />
              <span className="mock-marker mock-marker-selected" />
            </div>
            <div className="mockup-panel">
              <div>
                <span className="ui-badge ui-tone-success">Available</span>
                <strong>Acropolis Hub 04</strong>
                <small>greenPlug · CCS · 150 kW</small>
              </div>
              <div className="mockup-metrics">
                <span><strong>312</strong><small>views</small></span>
                <span><strong>98.2%</strong><small>fresh</small></span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
