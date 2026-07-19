"use client";

import { useQuery } from "@tanstack/react-query";
import { PortalPageHeader } from "@/components/portal/portal-shell";
import { BarChart } from "@/components/portal/bar-chart";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DynamicHeatmap } from "@/components/maps/dynamic-heatmap";
import { ngoApi } from "@/lib/api/ngo";

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ngo", "analytics"],
    queryFn: ngoApi.analytics,
  });

  const kpis = data
    ? [
        { label: "Total Rescues", value: data.kpis.total_rescues },
        {
          label: "Avg. Response",
          value: data.kpis.avg_response_minutes != null ? `${data.kpis.avg_response_minutes}m` : "-",
        },
        { label: "Active Volunteers", value: data.kpis.active_volunteers },
        { label: "Success Rate", value: `${Math.round(data.kpis.success_rate * 100)}%` },
        { label: "Cases This Month", value: data.kpis.cases_this_month },
      ]
    : [];

  return (
    <>
      <PortalPageHeader title="Analytics" description="Operational performance powered by your live data." />

      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-gutter lg:grid-cols-5">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
            : kpis.map((k) => (
                <Card key={k.label} className="flex flex-col gap-2 p-stack-md">
                  <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{k.label}</span>
                  <span className="text-headline-md font-bold text-primary">{k.value}</span>
                </Card>
              ))}
        </div>

        {/* Charts */}
        <div className="grid gap-gutter lg:grid-cols-2">
          <Card className="flex flex-col gap-4 p-stack-md">
            <h2 className="text-headline-sm text-primary">Daily Reports (14d)</h2>
            {isLoading ? <Skeleton className="h-40 w-full" /> : <BarChart data={data?.daily_reports ?? []} accent="secondary" />}
          </Card>
          <Card className="flex flex-col gap-4 p-stack-md">
            <h2 className="text-headline-sm text-primary">Weekly Rescues</h2>
            {isLoading ? <Skeleton className="h-40 w-full" /> : <BarChart data={data?.weekly_rescues ?? []} accent="success" />}
          </Card>
          <Card className="flex flex-col gap-4 p-stack-md">
            <h2 className="text-headline-sm text-primary">Volunteer Workload</h2>
            {isLoading ? <Skeleton className="h-40 w-full" /> : <BarChart data={data?.volunteer_workload ?? []} accent="primary" />}
          </Card>
          <Card className="flex flex-col gap-4 p-stack-md">
            <h2 className="text-headline-sm text-primary">Rescue Heatmap</h2>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (data?.heatmap.length ?? 0) > 0 ? (
              <DynamicHeatmap points={data!.heatmap} />
            ) : (
              <div className="flex h-56 items-center justify-center text-label-sm text-on-surface-variant">
                No location data yet
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
