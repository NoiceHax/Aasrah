"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PortalPageHeader } from "@/components/portal/portal-shell";
import { BarChart } from "@/components/portal/bar-chart";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ngoApi } from "@/lib/api/ngo";

const KPIS = [
  { key: "pending_nearby", label: "Pending Nearby", icon: "near_me", accent: "text-warning" },
  { key: "claimed_cases", label: "Claimed Cases", icon: "assignment_turned_in", accent: "text-secondary" },
  { key: "active_rescues", label: "Active Rescues", icon: "bolt", accent: "text-secondary" },
  { key: "completed_rescues", label: "Completed", icon: "task_alt", accent: "text-success" },
  { key: "available_volunteers", label: "Available Volunteers", icon: "group", accent: "text-primary" },
] as const;

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ngo", "dashboard"],
    queryFn: ngoApi.dashboard,
  });

  return (
    <>
      <PortalPageHeader
        title="Dashboard"
        description="Your operational overview at a glance."
        action={
          <Button href="/portal/reports" leadingIcon="search" size="sm">
            Discover Reports
          </Button>
        }
      />

      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-gutter lg:grid-cols-5">
          {KPIS.map((kpi) => (
            <Card key={kpi.key} className="flex flex-col gap-2 p-stack-md">
              <div className="flex items-center justify-between">
                <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  {kpi.label}
                </span>
                <Icon name={kpi.icon} className={`text-[20px] ${kpi.accent}`} />
              </div>
              {isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <span className="text-headline-md font-bold text-primary">
                  {isError ? "-" : (data?.[kpi.key] ?? 0)}
                </span>
              )}
            </Card>
          ))}
        </div>

        {/* Performance + chart */}
        <div className="grid gap-gutter lg:grid-cols-3">
          <Card className="flex flex-col gap-4 p-stack-md lg:col-span-2">
            <h2 className="text-headline-sm text-primary">Weekly Rescues</h2>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <BarChart data={data?.weekly_rescues ?? []} accent="success" />
            )}
          </Card>

          <div className="flex flex-col gap-gutter">
            <Card className="flex flex-col gap-1 p-stack-md">
              <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                Avg. Response Time
              </span>
              <span className="text-headline-md font-bold text-primary">
                {data?.avg_response_minutes != null ? `${data.avg_response_minutes}m` : "-"}
              </span>
            </Card>
            <Card className="flex flex-col gap-1 p-stack-md">
              <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                Success Rate
              </span>
              <span className="text-headline-md font-bold text-primary">
                {data ? `${Math.round(data.success_rate * 100)}%` : "-"}
              </span>
            </Card>
          </div>
        </div>

        {/* Quick actions */}
        <Card className="p-stack-md">
          <h2 className="mb-4 text-headline-sm text-primary">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { href: "/portal/reports", icon: "search", label: "Discover Reports" },
              { href: "/portal/cases", icon: "assignment", label: "My Cases" },
              { href: "/portal/volunteers", icon: "group", label: "Volunteers" },
              { href: "/portal/analytics", icon: "analytics", label: "Analytics" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex flex-col items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-center transition-colors hover:border-secondary/50 hover:bg-surface-container"
              >
                <Icon name={a.icon} className="text-[28px] text-secondary" />
                <span className="text-label-md font-medium text-primary">{a.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
