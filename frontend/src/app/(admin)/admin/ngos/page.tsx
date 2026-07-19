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
import { CreateNgoForm } from "@/components/admin/create-ngo-form";

export default function NgoVerificationPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [pendingOnly, setPendingOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "ngos", pendingOnly],
    queryFn: () => adminApi.ngos(pendingOnly),
  });

  const verify = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => adminApi.verifyNgo(id, approve),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "NGO verified" : "NGO rejected");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error("Action failed", normalizeError(e).message),
  });

  return (
    <>
      <ShellPageHeader
        title="NGOs"
        description="Create, review, and verify partner organizations."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              leadingIcon={pendingOnly ? "filter_list" : "list"}
              onClick={() => setPendingOnly((p) => !p)}
            >
              {pendingOnly ? "Pending only" : "All NGOs"}
            </Button>
            <Button
              size="sm"
              leadingIcon={showCreate ? "close" : "add"}
              onClick={() => setShowCreate((s) => !s)}
            >
              {showCreate ? "Cancel" : "Create NGO"}
            </Button>
          </div>
        }
      />

      <div className="space-y-3 p-margin-mobile md:p-margin-desktop">
        {showCreate && (
          <CreateNgoForm
            onCreated={() => {
              setShowCreate(false);
              qc.invalidateQueries({ queryKey: ["admin"] });
            }}
          />
        )}
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
        ) : data && data.length > 0 ? (
          data.map((ngo) => (
            <Card key={ngo.id} className="flex flex-col gap-3 p-stack-md sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                  <Icon name="corporate_fare" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-label-md font-semibold text-primary">{ngo.name}</p>
                    {ngo.is_verified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </div>
                  <p className="text-label-sm text-on-surface-variant">
                    {ngo.focus_area ?? "-"} · {ngo.location ?? "-"} · {ngo.contact_email ?? "no contact"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!ngo.is_verified ? (
                  <>
                    <Button size="sm" variant="success" leadingIcon="check" onClick={() => verify.mutate({ id: ngo.id, approve: true })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" leadingIcon="close" onClick={() => verify.mutate({ id: ngo.id, approve: false })}>
                      Reject
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" leadingIcon="block" onClick={() => verify.mutate({ id: ngo.id, approve: false })}>
                    Suspend
                  </Button>
                )}
              </div>
            </Card>
          ))
        ) : (
          <EmptyState icon="verified" title="Nothing to review" description="No NGOs match this filter." />
        )}
      </div>
    </>
  );
}
