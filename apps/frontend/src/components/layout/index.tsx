import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import markUrl from "../../assets/brand/saasplug-mark.svg";
import type { Role } from "../../lib/types";
import { cx } from "../../lib/utils/classNames";

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={cx("brand", compact && "brand-compact")} aria-label="saasPlug home">
      <img className="brand-mark" src={markUrl} alt="" />
      <span>
        <strong>saasPlug</strong>
        <small>Charging infrastructure cockpit</small>
      </span>
    </Link>
  );
}

export function AppShellFrame({
  children,
  topbar,
  sidebar,
}: {
  children: ReactNode;
  topbar: ReactNode;
  sidebar?: ReactNode;
}) {
  return (
    <div className="app-shell">
      {topbar}
      <div className={cx("app-shell-body", sidebar ? "has-sidebar" : undefined)}>
        {sidebar}
        <div className="app-shell-content">{children}</div>
      </div>
    </div>
  );
}

export function TopBar({
  children,
  actions,
}: {
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="topbar">
      <BrandLockup />
      {children}
      {actions ? <div className="topbar-actions">{actions}</div> : null}
    </header>
  );
}

export function Sidebar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside className="sidebar" aria-label={label}>
      {children}
    </aside>
  );
}

export function SidebarNav({ items }: { items: Array<{ href: string; label: string }> }) {
  return (
    <nav className="sidebar-nav">
      {items.map((item) => (
        <NavLink to={item.href} key={item.href}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function RoleSwitcher({ roles }: { roles: Role[] }) {
  const role = roles[0] ?? "EV_USER";
  return <span className="role-switcher">{role.replace("_", " ")}</span>;
}

export function RoleEntry({
  items,
}: {
  items: Array<{ title: string; description: string; href: string; icon?: string }>;
}) {
  return (
    <div className="role-entry-grid">
      {items.map((item) => (
        <Link className="role-entry-card" to={item.href} key={item.title}>
          {item.icon ? <img src={item.icon} alt="" /> : null}
          <span>
            <strong>{item.title}</strong>
            <small>{item.description}</small>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function PageContainer({
  children,
  narrow = false,
  className,
}: {
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return <main className={cx("page", narrow && "page-narrow", className)}>{children}</main>;
}

export function SplitPane({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("split-pane", className)}>{children}</section>;
}

export function DashboardGrid({ children }: { children: ReactNode }) {
  return <section className="dashboard-grid">{children}</section>;
}

export function AuthLayoutFrame({ children }: { children: ReactNode }) {
  return <main className="auth-page">{children}</main>;
}

export function MarketingLayout({ children }: { children: ReactNode }) {
  return <main className="marketing-layout">{children}</main>;
}
