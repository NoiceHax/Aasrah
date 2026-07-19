"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { routes, portalPathForRole } from "@/lib/routes";
import { Icon } from "@/components/ui/icon";
import type { UserRole } from "@/lib/api/types";

/**
 * Generic client-side route guard. Redirects unauthenticated users to login
 * (preserving `next` via `redirectTo`) and users without an allowed role to
 * THEIR OWN portal (admin → /admin, volunteer → /volunteer-portal), so nobody
 * is left rendering chrome for a role they don't hold.
 */
export function RoleGuard({
  allow,
  redirectTo,
  children,
}: {
  allow: UserRole[];
  redirectTo: string;
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const allowed = !!user && allow.includes(user.role);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`${routes.login}?next=${encodeURIComponent(redirectTo)}`);
    } else if (!allowed) {
      router.replace(portalPathForRole(user?.role) ?? routes.home);
    }
  }, [isLoading, isAuthenticated, allowed, router, redirectTo, user?.role]);

  if (isLoading || !isAuthenticated || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
          <Icon name="progress_activity" className="animate-spin text-[32px] text-secondary" />
          <p className="text-body-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
