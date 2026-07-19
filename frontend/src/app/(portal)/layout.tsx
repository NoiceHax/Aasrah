import type { Metadata } from "next";
import { PortalGuard } from "@/components/portal/portal-guard";
import { PortalShell } from "@/components/portal/portal-shell";

export const metadata: Metadata = {
  title: { default: "NGO Portal", template: "%s | Aasrah Portal" },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalGuard>
      <PortalShell>{children}</PortalShell>
    </PortalGuard>
  );
}
