import type { ReactNode } from "react";

import { useAuth } from "../features/auth/AuthContext";
import { AppShellFrame, RoleSwitcher, Sidebar, SidebarNav, TopBar } from "./layout";

export function AppShell({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const isEvUser = session?.user.roles.includes("EV_USER");
  const isProviderAdmin = session?.user.roles.includes("PROVIDER_ADMIN");
  const isOperator = session?.user.roles.includes("OPERATOR");
  const workspaceItems = [
    ...(isEvUser
      ? [
          { href: "/map", label: "Map" },
          { href: "/reservations", label: "Reservations" },
        ]
      : []),
    ...(isProviderAdmin
      ? [
          { href: "/provider/dashboard", label: "Overview" },
          { href: "/provider/points", label: "Charging points" },
          { href: "/provider/analytics", label: "Analytics" },
          { href: "/provider/invoices", label: "Invoices" },
          { href: "/provider/export", label: "Exports" },
          { href: "/provider/settings", label: "Settings" },
        ]
      : []),
    ...(isOperator
      ? [
          { href: "/operator/dashboard", label: "Overview" },
          { href: "/operator/providers", label: "Providers" },
          { href: "/operator/analytics", label: "Analytics" },
          { href: "/operator/catalog", label: "Catalog health" },
          { href: "/operator/invoices", label: "Invoices" },
          { href: "/operator/pricing", label: "Pricing" },
          { href: "/operator/sync", label: "Sync" },
          { href: "/operator/system", label: "System" },
        ]
      : []),
  ];
  const navItems = session
    ? [...workspaceItems, { href: "/profile", label: "Profile" }, { href: "/logout", label: "Logout" }]
    : workspaceItems;

  return (
    <AppShellFrame
      topbar={<TopBar />}
      sidebar={session ? (
        <Sidebar label="Workspace">
          <div className="sidebar-workspace">
            <RoleSwitcher roles={session.user.roles} />
          </div>
          <SidebarNav items={navItems} />
        </Sidebar>
      ) : null}
    >
      {children}
    </AppShellFrame>
  );
}
