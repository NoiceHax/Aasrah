"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { ngoApi, notificationsApi } from "@/lib/api/ngo";
import { siteConfig } from "@/lib/site-config";
import { routes } from "@/lib/routes";

const navItems = [
  { label: "Dashboard", href: "/portal", icon: "dashboard" },
  { label: "Reports", href: "/portal/reports", icon: "description" },
  { label: "Cases", href: "/portal/cases", icon: "assignment" },
  { label: "Volunteers", href: "/portal/volunteers", icon: "group" },
  { label: "Analytics", href: "/portal/analytics", icon: "analytics" },
  { label: "Notifications", href: "/portal/notifications", icon: "notifications" },
  { label: "Profile", href: "/portal/profile", icon: "corporate_fare" },
  { label: "Settings", href: "/portal/settings", icon: "settings" },
];

export function PortalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["ngo", "profile"],
    queryFn: ngoApi.profile,
    staleTime: 60_000,
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationsApi.list({ unread_only: true }),
    refetchInterval: 30_000,
  });

  const isActive = (href: string) =>
    href === "/portal" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex h-full w-[260px] flex-col gap-2 border-r border-outline-variant bg-surface-container-low p-stack-md">
      <div className="mb-2 flex items-center justify-between px-2">
        <Link href="/portal" className="flex items-center gap-2" onClick={onNavigate}>
          <Image src="/logo.png" alt={siteConfig.name} width={40} height={40} className="h-10 w-10 object-contain" />
          <div className="flex flex-col">
            <span className="text-label-md font-bold leading-tight text-primary">{siteConfig.name}</span>
            <span className="text-label-sm text-on-surface-variant">NGO Dashboard</span>
          </div>
        </Link>
      </div>

      {profile && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-high text-primary">
            <Icon name="corporate_fare" className="text-[18px]" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-label-sm font-semibold text-primary">{profile.name}</p>
            {profile.is_verified ? (
              <span className="flex items-center gap-1 text-label-sm text-on-tertiary-fixed-variant">
                <Icon name="verified" className="text-[14px]" filled />
                Verified
              </span>
            ) : (
              <span className="text-label-sm text-warning">Unverified</span>
            )}
          </div>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const showBadge = item.href === "/portal/notifications" && (notifications?.unread_count ?? 0) > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                active
                  ? "bg-secondary-fixed font-semibold text-on-secondary-fixed-variant"
                  : "text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              <Icon name={item.icon} className="text-[20px]" filled={active} />
              <span className="flex-1 text-label-md">{item.label}</span>
              {showBadge && (
                <Badge variant="danger" className="px-2 py-0">
                  {notifications!.unread_count}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-outline-variant pt-3">
        <div className="px-3 py-1">
          <p className="truncate text-label-sm font-medium text-primary">{user?.full_name || user?.email}</p>
          <p className="truncate text-label-sm text-on-surface-variant">{user?.email}</p>
        </div>
        <Link
          href={routes.home}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="public" className="text-[20px]" />
          <span className="text-label-md">Public Site</span>
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="logout" className="text-[20px]" />
          <span className="text-label-md">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
