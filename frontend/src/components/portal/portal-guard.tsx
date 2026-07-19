"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { routes, portalPathForRole } from "@/lib/routes";
import { Icon } from "@/components/ui/icon";

/**
 * Gate for NGO portal routes. Renders children for the NGO role and for admins
 * (who have platform-wide oversight and can operate the NGO portal on behalf of
 * a case's owning NGO). Unauthenticated users go to login; any other role is
 * redirected to its own portal.
 */
export function PortalGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const allowed = user?.role === "ngo" || user?.role === "admin";

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`${routes.login}?next=/portal`);
    } else if (!allowed) {
      // Send the user to their own portal (admin → /admin, volunteer →
      // /volunteer-portal), falling back home.
      router.replace(portalPathForRole(user?.role) ?? routes.home);
    }
  }, [isLoading, isAuthenticated, allowed, router, user?.role]);

  if (isLoading || !isAuthenticated || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
          <Icon name="progress_activity" className="animate-spin text-[32px] text-secondary" />
          <p className="text-body-sm">Loading portal…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
