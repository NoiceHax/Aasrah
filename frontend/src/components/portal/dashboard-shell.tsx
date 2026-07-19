"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { GlobalSearch } from "@/components/portal/global-search";
import { useAuth } from "@/components/providers/auth-provider";
import { notificationsApi } from "@/lib/api/ngo";
import { routes } from "@/lib/routes";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface ShellProps {
  title: string;
  subtitle: string;
  nav: NavItem[];
  notificationsHref?: string;
  showSearch?: boolean;
  children: React.ReactNode;
}

function Sidebar({
  title,
  subtitle,
  nav,
  notificationsHref,
  onNavigate,
}: Omit<ShellProps, "children" | "showSearch"> & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationsApi.list({ unread_only: true }),
    refetchInterval: 60_000,
  });

  const isActive = (href: string) =>
    href === nav[0]?.href ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex h-full w-[260px] flex-col gap-2 border-r border-outline-variant bg-surface-container-low p-stack-md">
      <Link href={nav[0]?.href ?? routes.home} className="mb-2 flex items-center gap-2 px-2" onClick={onNavigate}>
        <Image src="/logo.png" alt="Aasrah" width={40} height={40} className="h-10 w-10 object-contain" />
        <div className="flex flex-col">
          <span className="text-label-md font-bold leading-tight text-primary">Aasrah</span>
          <span className="text-label-sm text-on-surface-variant">{subtitle}</span>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {nav.map((item) => {
          const active = isActive(item.href);
          const showBadge = notificationsHref === item.href && (notifications?.unread_count ?? 0) > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                active
                  ? "bg-secondary-fixed font-semibold text-on-secondary-fixed-variant"
                  : "text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              <Icon name={item.icon} className="text-[20px]" filled={active} />
              <span className="flex-1 text-label-md">{item.label}</span>
              {showBadge && <Badge variant="danger" className="px-2 py-0">{notifications!.unread_count}</Badge>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-outline-variant pt-3">
        <div className="px-3 py-1">
          <p className="truncate text-label-sm font-medium text-primary">{user?.full_name || user?.email}</p>
          <p className="truncate text-label-sm capitalize text-on-surface-variant">{user?.role}</p>
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

/** Generic sidebar + top-bar shell shared by the volunteer and admin portals. */
export function DashboardShell({ title, subtitle, nav, notificationsHref, showSearch, children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden lg:block">
        <div className="fixed inset-y-0 left-0">
          <Sidebar title={title} subtitle={subtitle} nav={nav} notificationsHref={notificationsHref} />
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            />
            <motion.div
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <Sidebar title={title} subtitle={subtitle} nav={nav} notificationsHref={notificationsHref} onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-1 flex-col lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-primary hover:bg-surface-container-high lg:hidden"
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>
          <span className="text-label-md font-bold text-primary lg:hidden">{title}</span>
          {showSearch && <GlobalSearch className="ml-auto w-full max-w-md" />}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export function ShellPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-outline-variant bg-surface-container-lowest px-margin-mobile py-6 md:flex-row md:items-center md:justify-between md:px-margin-desktop">
      <div>
        <h1 className="text-headline-sm text-primary md:text-headline-md">{title}</h1>
        {description && <p className="mt-1 text-body-sm text-on-surface-variant">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}
