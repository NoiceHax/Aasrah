import type { Metadata } from "next";
import { RoleGuard } from "@/components/portal/role-guard";
import { DashboardShell, type NavItem } from "@/components/portal/dashboard-shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Aasrah Admin" },
  robots: { index: false, follow: false },
};

const nav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" },
  { label: "Insights", href: "/admin/insights", icon: "lightbulb" },
  { label: "NGOs", href: "/admin/ngos", icon: "corporate_fare" },
  { label: "Volunteers", href: "/admin/volunteers", icon: "volunteer_activism" },
  { label: "Users", href: "/admin/users", icon: "group" },
  { label: "Automation", href: "/admin/automation", icon: "bolt" },
  { label: "Announcements", href: "/admin/announcements", icon: "campaign" },
  { label: "Monitoring", href: "/admin/monitoring", icon: "monitoring" },
  { label: "Audit Logs", href: "/admin/audit", icon: "history" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow={["admin"]} redirectTo="/admin">
      <DashboardShell title="Aasrah Admin" subtitle="Platform Console" nav={nav} showSearch>
        {children}
      </DashboardShell>
    </RoleGuard>
  );
}
