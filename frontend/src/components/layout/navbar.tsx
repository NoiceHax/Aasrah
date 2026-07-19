"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { mainNav, routes, portalPathForRole } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/components/providers/auth-provider";

export function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sync the mobile menu to navigation: close it whenever the route changes
  // (covers the browser back/forward buttons, not just in-menu clicks).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === routes.home ? pathname === href : pathname.startsWith(href);

  const portalPath = portalPathForRole(user?.role);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-outline-variant bg-surface-container-lowest/90 backdrop-blur-glass shadow-sm"
          : "border-b border-transparent bg-surface-container-lowest",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
        <Link href={routes.home} className="flex items-center gap-2" aria-label={siteConfig.name}>
          <Image src="/logo.png" alt={siteConfig.name} width={44} height={44} className="h-11 w-11 object-contain" priority />
          <span className="text-headline-sm font-extrabold tracking-tight text-primary">{siteConfig.name}</span>
        </Link>

        <div className="hidden items-center gap-stack-lg md:flex">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-label-md transition-colors hover:text-secondary",
                isActive(item.href)
                  ? "font-semibold text-secondary"
                  : "text-on-surface-variant",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-stack-sm md:flex">
          {isAuthenticated ? (
            <>
              {portalPath && (
                <Button href={portalPath} variant="outline" size="sm" leadingIcon="dashboard">
                  Portal
                </Button>
              )}
              <span className="flex items-center gap-2 text-label-md text-on-surface-variant">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-fixed text-label-sm font-semibold text-on-secondary-fixed-variant">
                  {(user?.full_name || user?.email || "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[140px] truncate">{user?.full_name || user?.email}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                Sign Out
              </Button>
            </>
          ) : (
            <Button href={routes.login} variant="ghost" size="sm">
              Sign In
            </Button>
          )}
          <Button href={routes.report} variant="success" size="sm" leadingIcon="report">
            Report
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-primary hover:bg-surface-container-high md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-t border-outline-variant bg-surface-container-lowest md:hidden"
          >
            <div className="flex flex-col gap-1 px-margin-mobile py-4">
              {mainNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-body-md transition-colors",
                    isActive(item.href)
                      ? "bg-secondary-fixed font-semibold text-on-secondary-fixed-variant"
                      : "text-on-surface-variant hover:bg-surface-container-high",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                {isAuthenticated ? (
                  <Button variant="outline" fullWidth onClick={() => void logout()}>
                    Sign Out
                  </Button>
                ) : (
                  <Button href={routes.login} variant="outline" fullWidth>
                    Sign In
                  </Button>
                )}
                <Button href={routes.report} variant="success" fullWidth leadingIcon="report">
                  Report a Person
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
