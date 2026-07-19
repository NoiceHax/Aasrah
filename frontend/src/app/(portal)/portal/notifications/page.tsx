"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalPageHeader } from "@/components/portal/portal-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationsApi } from "@/lib/api/ngo";
import type { NotificationType } from "@/lib/api/types";

const iconFor: Record<NotificationType, { icon: string; color: string }> = {
  success: { icon: "check_circle", color: "text-success" },
  error: { icon: "error", color: "text-error" },
  warning: { icon: "warning", color: "text-warning" },
  info: { icon: "info", color: "text-secondary" },
};

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => notificationsApi.list(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });

  return (
    <>
      <PortalPageHeader
        title="Notifications"
        description={data ? `${data.unread_count} unread` : undefined}
        action={
          <Button
            size="sm"
            variant="outline"
            leadingIcon="done_all"
            disabled={!data || data.unread_count === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        }
      />

      <div className="space-y-3 p-margin-mobile md:p-margin-desktop">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
        ) : data && data.items.length > 0 ? (
          data.items.map((n) => {
            const cfg = iconFor[n.type];
            return (
              <Card
                key={n.id}
                className={`flex items-start gap-3 p-stack-md ${n.is_read ? "opacity-60" : ""}`}
              >
                <Icon name={cfg.icon} className={`text-[24px] ${cfg.color}`} filled />
                <div className="flex-1">
                  <p className="text-label-md font-semibold text-primary">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-body-sm text-on-surface-variant">{n.body}</p>}
                  <p className="mt-1 text-label-sm text-on-surface-variant">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate(n.id)}
                    className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high"
                    title="Mark read"
                  >
                    <Icon name="mark_email_read" className="text-[18px]" />
                  </button>
                )}
              </Card>
            );
          })
        ) : (
          <Card className="p-stack-lg text-center text-on-surface-variant">
            <Icon name="notifications_off" className="text-[32px]" />
            <p className="mt-2 text-body-sm">No notifications yet.</p>
          </Card>
        )}
      </div>
    </>
  );
}
