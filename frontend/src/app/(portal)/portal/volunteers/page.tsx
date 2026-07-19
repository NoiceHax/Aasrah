"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalPageHeader } from "@/components/portal/portal-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/notifications/toast";
import { ngoApi } from "@/lib/api/ngo";
import { normalizeError } from "@/lib/api/client";

export default function VolunteersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  const { data: volunteers, isLoading } = useQuery({
    queryKey: ["ngo", "volunteers", { search, availableOnly }],
    queryFn: () => ngoApi.volunteers({ search: search.trim() || undefined, available_only: availableOnly || undefined }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_available }: { id: string; is_available: boolean }) =>
      ngoApi.updateVolunteer(id, { is_available }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ngo", "volunteers"] });
    },
    onError: (e) => toast.error("Couldn't update", normalizeError(e).message),
  });

  return (
    <>
      <PortalPageHeader title="Volunteers" description="Manage your volunteer roster and availability." />

      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        <Card className="p-stack-md">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="Search"
              leadingIcon="search"
              placeholder="Name or skill…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <label className="flex h-11 items-center gap-2 text-label-md text-on-surface-variant">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="rounded border-outline-variant text-secondary focus:ring-secondary"
              />
              Available only
            </label>
          </div>
        </Card>

        <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-lg" />)
            : volunteers?.map((v) => (
                <Card key={v.id} className="flex flex-col gap-3 p-stack-md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-fixed text-label-md font-semibold text-on-secondary-fixed-variant">
                        {(v.name ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-label-md font-semibold text-primary">{v.name}</p>
                        <p className="text-label-sm text-on-surface-variant">{v.role_title ?? "Volunteer"}</p>
                      </div>
                    </div>
                    <Badge variant={v.is_available ? "success" : "neutral"}>
                      {v.is_available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>

                  {v.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {v.skills.map((s) => (
                        <span key={s} className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-outline-variant pt-3 text-label-sm text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <Icon name="task_alt" className="text-[16px]" /> {v.completed_rescues} rescues
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="assignment_ind" className="text-[16px]" /> {v.active_assignments} active
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: v.id, is_available: !v.is_available })}
                    className="text-label-sm font-medium text-secondary hover:underline"
                  >
                    Toggle availability
                  </button>
                </Card>
              ))}
          {!isLoading && volunteers?.length === 0 && (
            <p className="text-body-sm text-on-surface-variant">No volunteers found.</p>
          )}
        </div>
      </div>
    </>
  );
}
