"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { StatusBadge, PriorityBadge } from "@/components/portal/status-badge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { volunteerApi } from "@/lib/api/volunteer";

const assignmentBadge: Record<string, "neutral" | "secondary" | "success" | "warning" | "danger" | "info"> = {
  assigned: "warning",
  accepted: "secondary",
  on_route: "secondary",
  arrived: "secondary",
  in_progress: "secondary",
  completed: "success",
  declined: "danger",
  removed: "neutral",
};

export default function AssignmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["volunteer", "assignments"],
    queryFn: volunteerApi.assignments,
  });

  return (
    <>
      <ShellPageHeader title="Assignments" description="Your rescue assignment history." />
      <div className="space-y-3 p-margin-mobile md:p-margin-desktop">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
        ) : data && data.length > 0 ? (
          data.map((a) => (
            <Link key={a.id} href={`/volunteer-portal/assignments/${a.id}`}>
              <Card className="flex items-center justify-between p-stack-md transition-colors hover:border-secondary/50">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary">#{a.report.tracking_id}</span>
                    <PriorityBadge priority={a.report.priority} />
                  </div>
                  <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                    <Icon name="location_on" className="text-[16px]" />
                    {a.report.address ?? "No address"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={assignmentBadge[a.status] ?? "neutral"}>{a.status.replace(/_/g, " ")}</Badge>
                  <StatusBadge status={a.report.status} />
                </div>
              </Card>
            </Link>
          ))
        ) : (
          <EmptyState icon="assignment" title="No assignments yet" description="Assignments from NGOs will appear here." />
        )}
      </div>
    </>
  );
}
