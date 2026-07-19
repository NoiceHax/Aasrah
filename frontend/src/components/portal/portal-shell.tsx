"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PortalSidebar } from "./portal-sidebar";
import { Icon } from "@/components/ui/icon";

export function PortalShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="fixed inset-y-0 left-0">
          <PortalSidebar />
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <PortalSidebar onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-1 flex-col lg:pl-[260px]">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-primary hover:bg-surface-container-high"
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>
          <span className="text-label-md font-bold text-primary">Aasrah Portal</span>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export function PortalPageHeader({
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
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}
