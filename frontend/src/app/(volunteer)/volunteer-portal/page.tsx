"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { StatusBadge, PriorityBadge } from "@/components/portal/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/notifications/toast";
import { volunteerApi } from "@/lib/api/volunteer";
import { normalizeError } from "@/lib/api/client";
import type { VolAssignment } from "@/lib/api/types";

function AssignmentCard({ a }: { a: VolAssignment }) {
  return (
    <Link
      href={`/volunteer-portal/assignments/${a.id}`}
      className="block rounded-lg border border-outline-variant bg-surface-container-lowest p-stack-md transition-colors hover:border-secondary/50"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-primary">#{a.report.tracking_id}</span>
        <PriorityBadge priority={a.report.priority} />
      </div>
      <p className="mt-1 line-clamp-2 text-body-sm text-on-surface-variant">{a.report.description}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
          <Icon name="location_on" className="text-[16px]" />
          {a.report.address ?? "No address"}
        </span>
        <StatusBadge status={a.report.status} />
      </div>
    </Link>
  );
}

export default function VolunteerDashboard() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["volunteer", "profile"],
    queryFn: volunteerApi.profile,
  });
  const isPending = profile?.status === "pending";

  const { data, isLoading } = useQuery({
    queryKey: ["volunteer", "dashboard"],
    queryFn: volunteerApi.dashboard,
  });

  const availabilityMutation = useMutation({
    mutationFn: (available: boolean) => volunteerApi.setAvailability(available),
    onSuccess: (p) => {
      toast.success(p.is_available ? "You're now online" : "You're now offline");
      qc.invalidateQueries({ queryKey: ["volunteer"] });
    },
    onError: (e) => toast.error("Couldn't update", normalizeError(e).message),
  });

  return (
    <>
      <ShellPageHeader
        title="Volunteer Dashboard"
        description="Your assignments and availability."
        action={
          data && !isPending && (
            <Button
              variant={data.is_available ? "success" : "outline"}
              leadingIcon={data.is_available ? "wifi" : "wifi_off"}
              onClick={() => availabilityMutation.mutate(!data.is_available)}
              disabled={availabilityMutation.isPending}
            >
              {data.is_available ? "Online" : "Offline"}
            </Button>
          )
        }
      />

      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        {isPending && (
          <Card className="flex items-start gap-3 border-l-4 border-l-warning p-stack-md">
            <Icon name="hourglass_top" className="mt-0.5 text-[24px] text-warning" filled />
            <div>
              <h2 className="text-body-lg font-semibold text-on-surface">
                Your volunteer account is pending approval
              </h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                An administrator is reviewing your application. You can&apos;t accept
                rescue assignments yet, but you can{" "}
                <Link href="/volunteer-portal/profile" className="font-semibold text-secondary hover:underline">
                  complete your profile
                </Link>{" "}
                and choose how you&apos;d like to contribute in the meantime.
              </p>
            </div>
          </Card>
        )}
        {/* Stats */}
        <div className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
          {[
            { label: "Today", value: data?.today.length ?? 0, icon: "today" },
            { label: "Upcoming", value: data?.upcoming.length ?? 0, icon: "schedule" },
            { label: "Completed", value: data?.completed_count ?? 0, icon: "task_alt" },
            { label: "Hours", value: data?.total_hours ?? 0, icon: "timer" },
          ].map((s) => (
            <Card key={s.label} className="flex flex-col gap-2 p-stack-md">
              <div className="flex items-center justify-between">
                <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{s.label}</span>
                <Icon name={s.icon} className="text-[20px] text-secondary" />
              </div>
              {isLoading ? <Skeleton className="h-9 w-12" /> : <span className="text-headline-md font-bold text-primary">{s.value}</span>}
            </Card>
          ))}
        </div>

        {/* Active rescue */}
        <div>
          <h2 className="mb-3 text-headline-sm text-primary">Active Rescue</h2>
          {isLoading ? (
            <Skeleton className="h-28 w-full rounded-lg" />
          ) : data?.active ? (
            <AssignmentCard a={data.active} />
          ) : (
            <EmptyState icon="bolt" title="No active rescue" description="Accept an assignment to begin." />
          )}
        </div>

        {/* Upcoming */}
        <div>
          <h2 className="mb-3 text-headline-sm text-primary">Upcoming Assignments</h2>
          {isLoading ? (
            <Skeleton className="h-28 w-full rounded-lg" />
          ) : data && data.upcoming.length > 0 ? (
            <div className="grid gap-gutter md:grid-cols-2">
              {data.upcoming.map((a) => <AssignmentCard key={a.id} a={a} />)}
            </div>
          ) : (
            <EmptyState icon="inbox" title="No pending assignments" description="New assignments will appear here." />
          )}
        </div>
      </div>
    </>
  );
}
