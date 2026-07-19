import type { Metadata } from "next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        <Icon name="wifi_off" className="text-[32px]" />
      </div>
      <h1 className="text-headline-md text-primary">You&apos;re offline</h1>
      <p className="mt-3 max-w-md text-body-md text-on-surface-variant">
        Some features are unavailable without a connection. Cached pages still work, and any
        updates you make will sync when you&apos;re back online.
      </p>
      <Button href={routes.home} leadingIcon="refresh" className="mt-8">
        Try again
      </Button>
    </div>
  );
}
