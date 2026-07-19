"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/notifications/toast";
import { adminApi } from "@/lib/api/admin";
import { normalizeError } from "@/lib/api/client";
import type { VolunteerStatus } from "@/lib/api/types";

const statusBadge: Record<VolunteerStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  active: "success",
  inactive: "danger",
};

export default function AdminVolunteersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [pendingOnly, setPendingOnly] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "volunteers", pendingOnly],
    queryFn: () => adminApi.volunteers(pendingOnly),
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => adminApi.approveVolunteer(id, approve),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Volunteer approved" : "Volunteer rejected");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error("Action failed", normalizeError(e).message),
  });

  return (
    <>
      <ShellPageHeader
        title="Volunteers"
        description="Review and approve volunteer applications."
        action={
          <Button
            variant="outline"
            size="sm"
            leadingIcon={pendingOnly ? "filter_list" : "list"}
            onClick={() => setPendingOnly((p) => !p)}
          >
            {pendingOnly ? "Pending only" : "All volunteers"}
          </Button>
        }
      />

      <div className="space-y-3 p-margin-mobile md:p-margin-desktop">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
        ) : data && data.length > 0 ? (
          data.map((v) => (
            <Card key={v.id} className="flex flex-col gap-3 p-stack-md sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                  <Icon name="person" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-label-md font-semibold text-primary">{v.name ?? v.email}</p>
                    <Badge variant={statusBadge[v.status]}>{v.status}</Badge>
                  </div>
                  <p className="text-label-sm text-on-surface-variant">
                    {v.email ?? "-"} · {v.assignment_mode === "ngo_affiliated" ? (v.ngo_name ?? "NGO volunteer") : "Independent"}
                    {v.skills.length > 0 ? ` · ${v.skills.join(", ")}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {v.status === "pending" ? (
                  <>
                    <Button size="sm" variant="success" leadingIcon="check" disabled={decide.isPending} onClick={() => decide.mutate({ id: v.id, approve: true })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" leadingIcon="close" disabled={decide.isPending} onClick={() => decide.mutate({ id: v.id, approve: false })}>
                      Reject
                    </Button>
                  </>
                ) : v.status === "active" ? (
                  <Button size="sm" variant="outline" leadingIcon="block" disabled={decide.isPending} onClick={() => decide.mutate({ id: v.id, approve: false })}>
                    Deactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="success" leadingIcon="check" disabled={decide.isPending} onClick={() => decide.mutate({ id: v.id, approve: true })}>
                    Reactivate
                  </Button>
                )}
              </div>
            </Card>
          ))
        ) : (
          <EmptyState icon="group" title="No volunteers to review" description="Volunteer applications appear here." />
        )}
      </div>
    </>
  );
}
