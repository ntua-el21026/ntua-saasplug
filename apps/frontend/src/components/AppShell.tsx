import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";

export function AppShell({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const isEvUser = session?.user.roles.includes("EV_USER");
  const isProviderAdmin = session?.user.roles.includes("PROVIDER_ADMIN");
  const isOperator = session?.user.roles.includes("OPERATOR");

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="saasPlug home">
          <span className="brand-mark">sP</span>
          <span>
            <strong>saasPlug</strong>
            <small>EV charging reservations</small>
          </span>
        </Link>
        {session ? (
          <nav className="nav-links" aria-label="Primary">
            {isEvUser ? (
              <>
                <NavLink to="/map">Map</NavLink>
                <NavLink to="/reservations">Reservations</NavLink>
              </>
            ) : null}
            {isProviderAdmin ? (
              <>
                <NavLink to="/provider/dashboard">Provider</NavLink>
                <NavLink to="/provider/points">Points</NavLink>
                <NavLink to="/provider/analytics">Analytics</NavLink>
                <NavLink to="/provider/invoices">Invoices</NavLink>
                <NavLink to="/provider/export">Export</NavLink>
                <NavLink to="/provider/settings">Settings</NavLink>
              </>
            ) : null}
            {isOperator ? (
              <>
                <NavLink to="/operator/dashboard">Operator</NavLink>
                <NavLink to="/operator/providers">Providers</NavLink>
                <NavLink to="/operator/analytics">Analytics</NavLink>
                <NavLink to="/operator/catalog">Catalog</NavLink>
                <NavLink to="/operator/invoices">Invoices</NavLink>
                <NavLink to="/operator/pricing">Pricing</NavLink>
                <NavLink to="/operator/sync">Sync</NavLink>
                <NavLink to="/operator/system">System</NavLink>
              </>
            ) : null}
            <NavLink to="/profile">Profile</NavLink>
            <NavLink to="/logout">Logout</NavLink>
          </nav>
        ) : null}
      </header>
      {children}
    </div>
  );
}
