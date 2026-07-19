"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/notifications/toast";
import { subscribeToPush } from "@/lib/push";

/** Small button that opts the user into browser push notifications. */
export function PushOptIn() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    try {
      const res = await subscribeToPush();
      if (res.ok) toast.success("Push notifications enabled");
      else toast.warning("Not enabled", res.reason);
    } catch {
      toast.error("Couldn't enable push notifications");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" leadingIcon="notifications_active" onClick={enable} disabled={busy}>
      {busy ? "Enabling…" : "Enable push"}
    </Button>
  );
}
