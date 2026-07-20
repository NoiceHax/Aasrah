"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/notifications/toast";
import { tokenStore } from "@/lib/api/token-store";
import { ensureFreshToken } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/api/config";
import type { NotificationType, RealtimeEvent } from "@/lib/api/types";

function wsUrl(token: string): string {
  const wsBase = API_BASE_URL.replace(/^http/, "ws");
  return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
}

/**
 * Maintains a WebSocket to the backend while authenticated. Server events are
 * surfaced as toasts and used to invalidate React Query caches so the UI
 * updates live without polling. Reconnects with backoff on drop.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedByUs = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    closedByUs.current = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const token = tokenStore.getAccess();
      if (!token) return;

      let opened = false;
      const ws = new WebSocket(wsUrl(token));
      wsRef.current = ws;

      ws.onopen = () => {
        opened = true;
        retryRef.current = 0;
      };

      ws.onmessage = (e) => {
        let event: RealtimeEvent;
        try {
          event = JSON.parse(e.data);
        } catch {
          return;
        }
        handleEvent(event);
      };

      ws.onclose = () => {
        if (closedByUs.current) return;
        retryRef.current = Math.min(retryRef.current + 1, 6);
        const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
        reconnectTimer = window.setTimeout(async () => {
          if (closedByUs.current) return;
          // If the socket never opened, the handshake likely failed on an
          // expired access token. Refresh before retrying so we don't loop
          // forever on a dead token. If refresh fails, the session is over.
          if (!opened) {
            const fresh = await ensureFreshToken();
            if (!fresh) {
              closedByUs.current = true;
              return;
            }
          }
          connect();
        }, delay);
      };

      ws.onerror = () => ws.close();
    };

    const handleEvent = (event: RealtimeEvent) => {
      switch (event.type) {
        case "notification": {
          const p = event.payload as { title?: string; body?: string; type?: NotificationType };
          toast.notify({
            variant: p.type ?? "info",
            title: p.title ?? "Notification",
            description: p.body ?? undefined,
          });
          qc.invalidateQueries({ queryKey: ["notifications"] });
          // Refresh likely-affected dashboards/lists.
          qc.invalidateQueries({ queryKey: ["ngo"] });
          qc.invalidateQueries({ queryKey: ["volunteer"] });
          qc.invalidateQueries({ queryKey: ["admin"] });
          break;
        }
        case "report_created": {
          // The event is intentionally content-free — it says "something
          // changed", nothing about which report or where. Details arrive via
          // the authorized refetches below, which are scoped per viewer.
          toast.info("New report received");
          // A new report affects admin metrics, NGO discovery, and public stats.
          qc.invalidateQueries({ queryKey: ["admin"] });
          qc.invalidateQueries({ queryKey: ["ngo"] });
          qc.invalidateQueries({ queryKey: ["public", "stats"] });
          break;
        }
        case "announcement": {
          const p = event.payload as { title?: string; body?: string };
          toast.info(p.title ?? "Announcement", p.body ?? undefined);
          break;
        }
        default:
          break;
      }
    };

    connect();

    return () => {
      closedByUs.current = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [isAuthenticated, toast, qc]);

  return <>{children}</>;
}
