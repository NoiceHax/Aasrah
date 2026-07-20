"use client";

import { use, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { StatusBadge, PriorityBadge } from "@/components/portal/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicStaticMap } from "@/components/maps/dynamic-static-map";
import { EmergencyBanner } from "@/components/safety/emergency-banner";
import { useToast } from "@/components/notifications/toast";
import { volunteerApi } from "@/lib/api/volunteer";
import { normalizeError } from "@/lib/api/client";
import type { AssignmentStatus, VolAssignment } from "@/lib/api/types";

// What action the volunteer can take next, given the assignment status.
function nextAction(status: AssignmentStatus): { to: AssignmentStatus; label: string; icon: string } | null {
  switch (status) {
    case "accepted":
      return { to: "on_route", label: "Start: On Route", icon: "directions_car" };
    case "on_route":
      return { to: "arrived", label: "Mark Arrived", icon: "location_on" };
    case "arrived":
      return { to: "in_progress", label: "Begin Rescue", icon: "play_arrow" };
    default:
      return null;
  }
}

const CHECKLIST_ITEMS = [
  "Confirmed person's safety",
  "Provided immediate aid",
  "Coordinated with NGO",
  "Documented outcome",
];

export default function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const { data: a, isLoading, isError, error } = useQuery({
    queryKey: ["volunteer", "assignment", id],
    queryFn: () => volunteerApi.assignment(id),
    retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["volunteer"] });
  };

  const respond = useMutation({
    mutationFn: (accept: boolean) => volunteerApi.respond(id, accept),
    onSuccess: (r: VolAssignment) => {
      toast.success(r.status === "accepted" ? "Assignment accepted" : "Assignment declined");
      invalidate();
    },
    onError: (e) => toast.error("Action failed", normalizeError(e).message),
  });

  const advance = useMutation({
    mutationFn: (to: AssignmentStatus) => volunteerApi.advance(id, to),
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    onError: (e) => toast.error("Couldn't update", normalizeError(e).message),
  });

  const complete = useMutation({
    mutationFn: () => volunteerApi.complete(id, { notes: notes || undefined, checklist, hours: 1 }),
    onSuccess: () => {
      toast.success("Rescue completed", "Thank you for your service.");
      invalidate();
    },
    onError: (e) => toast.error("Couldn't complete", normalizeError(e).message),
  });

  const uploadImage = useMutation({
    mutationFn: (file: File) => volunteerApi.uploadCompletionImage(id, file),
    onSuccess: () => toast.success("Photo uploaded"),
    onError: (e) => toast.error("Upload failed", normalizeError(e).message),
  });

  if (isLoading) {
    return (
      <>
        <ShellPageHeader title="Assignment" />
        <div className="p-margin-mobile md:p-margin-desktop">
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (isError || !a) {
    const norm = normalizeError(error);
    return (
      <>
        <ShellPageHeader title="Assignment" />
        <div className="p-margin-mobile md:p-margin-desktop">
          <EmptyState
            icon={norm.status === 403 ? "lock" : "error_outline"}
            title={norm.status === 404 ? "Assignment not found" : "Couldn't load this assignment"}
            description={norm.status === 404 ? "It may have been removed or reassigned." : norm.message}
            actionLabel="Back to assignments"
            actionHref="/volunteer-portal/assignments"
          />
        </div>
      </>
    );
  }

  const action = nextAction(a.status);
  const r = a.report;

  return (
    <>
      <ShellPageHeader
        title={`Assignment #${r.tracking_id}`}
        description={r.address ?? undefined}
        action={<StatusBadge status={r.status} />}
      />

      <div className="grid gap-gutter p-margin-mobile md:p-margin-desktop lg:grid-cols-3">
        <div className="space-y-gutter lg:col-span-2">
          {/* A responder who arrives and finds a situation beyond their remit
              needs the number in one tap, not a memory test. */}
          <EmergencyBanner />
          <Card className="p-stack-md">
            <div className="mb-2 flex items-center gap-2">
              <PriorityBadge priority={r.priority} />
              <span className="text-label-md capitalize text-on-surface-variant">{r.situation}</span>
            </div>
            <p className="text-body-md text-on-surface">{r.description}</p>
          </Card>

          {r.latitude != null && r.longitude != null && (
            <Card className="p-stack-md">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-headline-sm text-primary">Location</h3>
                <a
                  href={`https://www.openstreetmap.org/directions?to=${r.latitude},${r.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-label-md text-secondary hover:underline"
                >
                  <Icon name="directions" className="text-[18px]" /> Navigate
                </a>
              </div>
              <DynamicStaticMap lat={r.latitude} lng={r.longitude} />
            </Card>
          )}

          {/* Completion form, shown when in progress */}
          {a.status === "in_progress" && (
            <Card className="p-stack-md">
              <h3 className="mb-3 text-headline-sm text-primary">Complete Rescue</h3>
              <div className="mb-4 flex flex-col gap-2">
                {CHECKLIST_ITEMS.map((item) => (
                  <label key={item} className="flex items-center gap-2 text-body-sm text-on-surface">
                    <input
                      type="checkbox"
                      checked={!!checklist[item]}
                      onChange={(e) => setChecklist((c) => ({ ...c, [item]: e.target.checked }))}
                      className="rounded border-outline-variant text-secondary focus:ring-secondary"
                    />
                    {item}
                  </label>
                ))}
              </div>
              <Textarea
                label="Completion notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Summary of the rescue outcome…"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage.mutate(f);
                  e.target.value = "";
                }}
              />
              <div className="mt-3 flex gap-2">
                <Button variant="outline" leadingIcon="add_a_photo" onClick={() => fileRef.current?.click()}>
                  Add Photo
                </Button>
                <Button
                  variant="success"
                  leadingIcon="task_alt"
                  disabled={complete.isPending}
                  onClick={() => complete.mutate()}
                >
                  Complete Rescue
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Action panel */}
        <div className="space-y-gutter">
          <Card className="flex flex-col gap-3 p-stack-md">
            <h3 className="text-headline-sm text-primary">Actions</h3>
            {a.status === "assigned" && (
              <>
                <Button variant="success" leadingIcon="check" disabled={respond.isPending} onClick={() => respond.mutate(true)}>
                  Accept Assignment
                </Button>
                <Button variant="outline" leadingIcon="close" disabled={respond.isPending} onClick={() => respond.mutate(false)}>
                  Decline
                </Button>
              </>
            )}
            {action && (
              <Button leadingIcon={action.icon} disabled={advance.isPending} onClick={() => advance.mutate(action.to)}>
                {action.label}
              </Button>
            )}
            {a.status === "completed" && (
              <div className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-on-success-soft">
                <Icon name="check_circle" className="text-[20px]" filled />
                <span className="text-label-md font-medium">Rescue completed</span>
              </div>
            )}
            {a.status === "declined" && (
              <p className="text-body-sm text-on-surface-variant">You declined this assignment.</p>
            )}
          </Card>

          <Card className="p-stack-md">
            <h3 className="mb-2 text-headline-sm text-primary">Status</h3>
            <p className="text-label-md capitalize text-on-surface-variant">{a.status.replace(/_/g, " ")}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
