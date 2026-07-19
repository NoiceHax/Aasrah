"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/notifications/toast";
import { ngoApi } from "@/lib/api/ngo";
import { normalizeError } from "@/lib/api/client";
import type { AssignmentStatus } from "@/lib/api/types";

const assignmentVariant: Record<AssignmentStatus, "neutral" | "secondary" | "success" | "warning" | "danger"> = {
  assigned: "secondary",
  accepted: "success",
  declined: "danger",
  on_route: "secondary",
  arrived: "secondary",
  in_progress: "secondary",
  completed: "success",
  removed: "neutral",
};

export function CaseAssignments({ reportId }: { reportId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const { data: assignments } = useQuery({
    queryKey: ["ngo", "assignments", reportId],
    queryFn: () => ngoApi.assignments(reportId),
  });

  const { data: volunteers } = useQuery({
    queryKey: ["ngo", "volunteers", "available"],
    queryFn: () => ngoApi.volunteers({ available_only: true }),
    enabled: picker,
  });

  // Recommended volunteers (ranked). Used to highlight the best picks.
  const { data: recommended } = useQuery({
    queryKey: ["ngo", "recommended", reportId],
    queryFn: () => ngoApi.recommendedVolunteers(reportId),
    enabled: picker,
  });
  const recommendedIds = new Set((recommended ?? []).slice(0, 3).map((r) => r.volunteer_id));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ngo", "assignments", reportId] });
    qc.invalidateQueries({ queryKey: ["ngo", "case", reportId] });
  };

  const assignMutation = useMutation({
    mutationFn: () => ngoApi.assign(reportId, selected),
    onSuccess: () => {
      toast.success("Volunteers assigned");
      setPicker(false);
      setSelected([]);
      invalidate();
    },
    onError: (e) => toast.error("Couldn't assign", normalizeError(e).message),
  });

  const removeMutation = useMutation({
    mutationFn: (assignmentId: string) => ngoApi.removeAssignment(reportId, assignmentId),
    onSuccess: () => {
      toast.success("Assignment removed");
      invalidate();
    },
    onError: (e) => toast.error("Couldn't remove", normalizeError(e).message),
  });

  const active = assignments?.filter((a) => a.status !== "removed") ?? [];

  return (
    <div className="flex flex-col gap-3">
      {active.length === 0 && !picker && (
        <p className="text-body-sm text-on-surface-variant">No volunteers assigned yet.</p>
      )}

      {active.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-fixed text-label-sm font-semibold text-on-secondary-fixed-variant">
              {(a.volunteer_name ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-label-md font-medium text-primary">{a.volunteer_name ?? "Volunteer"}</p>
              <Badge variant={assignmentVariant[a.status]}>{a.status}</Badge>
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeMutation.mutate(a.id)}
            className="rounded p-1.5 text-error hover:bg-error-container"
            title="Remove"
          >
            <Icon name="person_remove" className="text-[18px]" />
          </button>
        </div>
      ))}

      {picker ? (
        <div className="rounded-lg border border-outline-variant p-3">
          <p className="mb-2 text-label-md font-semibold text-primary">Select available volunteers</p>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {volunteers?.length === 0 && (
              <p className="text-body-sm text-on-surface-variant">No available volunteers.</p>
            )}
            {volunteers?.map((v) => (
              <label
                key={v.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-container-low"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(v.id)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked ? [...prev, v.id] : prev.filter((id) => id !== v.id),
                    )
                  }
                  className="rounded border-outline-variant text-secondary focus:ring-secondary"
                />
                <span className="flex flex-1 items-center gap-2 text-label-md text-primary">
                  {v.name}
                  {recommendedIds.has(v.id) && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Recommended</Badge>
                  )}
                </span>
                <span className="text-label-sm text-on-surface-variant">{v.skills.join(", ")}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPicker(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selected.length === 0 || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              Assign {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" leadingIcon="person_add" onClick={() => setPicker(true)}>
          Assign Volunteers
        </Button>
      )}
    </div>
  );
}
