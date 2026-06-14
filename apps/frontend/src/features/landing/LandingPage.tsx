import { Link } from "react-router-dom";

import chargerIcon from "../../assets/icons/charger.svg";
import invoiceIcon from "../../assets/icons/invoice.svg";
import operatorIcon from "../../assets/icons/operator.svg";
import plugIcon from "../../assets/icons/plug.svg";
import providerIcon from "../../assets/icons/provider.svg";
import { BrandLockup, MarketingLayout, RoleEntry } from "../../components/layout";

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

      <RoleEntry
        items={[
          { title: "EV user", description: "Search, compare, and reserve chargers.", href: "/login", icon: plugIcon },
          { title: "Provider admin", description: "Sign in after operator-managed onboarding.", href: "/login", icon: providerIcon },
          { title: "Operator", description: "Control catalog health, pricing, sync, and billing.", href: "/login", icon: operatorIcon },
        ]}
      />

      <section className="benefits-strip" aria-label="Platform benefits">
        <div>
          <img src={chargerIcon} alt="" />
          <strong>Viewport catalog</strong>
          <span>Bounds-based search keeps the map responsive.</span>
        </div>
        <div>
          <img src={providerIcon} alt="" />
          <strong>Provider operations</strong>
          <span>Freshness, status checks, and export workflows.</span>
        </div>
        <div>
          <img src={invoiceIcon} alt="" />
          <strong>Billing control</strong>
          <span>Issued invoices, mock payments, and pricing rules.</span>
        </div>
      </section>
    </MarketingLayout>
  );
}
