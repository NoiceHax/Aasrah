import type { Metadata } from "next";
import { RoleGuard } from "@/components/portal/role-guard";
import { DashboardShell, type NavItem } from "@/components/portal/dashboard-shell";

export const metadata: Metadata = {
  title: { default: "Volunteer", template: "%s | Aasrah Volunteer" },
  robots: { index: false, follow: false },
};

const nav: NavItem[] = [
  { label: "Dashboard", href: "/volunteer-portal", icon: "dashboard" },
  { label: "Assignments", href: "/volunteer-portal/assignments", icon: "assignment" },
  { label: "Performance", href: "/volunteer-portal/performance", icon: "trending_up" },
  { label: "Notifications", href: "/volunteer-portal/notifications", icon: "notifications" },
  { label: "Profile", href: "/volunteer-portal/profile", icon: "person" },
];

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow={["volunteer"]} redirectTo="/volunteer-portal">
      <DashboardShell
        title="Aasrah Volunteer"
        subtitle="Responder Portal"
        nav={nav}
        notificationsHref="/volunteer-portal/notifications"
      >
        {children}
      </DashboardShell>
    </RoleGuard>
  );
}
