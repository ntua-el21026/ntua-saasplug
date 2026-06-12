import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";

export function AppShell({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const isEvUser = session?.user.roles.includes("EV_USER");

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
            <NavLink to="/profile">Profile</NavLink>
            <NavLink to="/logout">Logout</NavLink>
          </nav>
        ) : null}
      </header>
      {children}
    </div>
  );
}
