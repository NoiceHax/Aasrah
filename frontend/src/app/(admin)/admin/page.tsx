"use client";

import { useQuery } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { BarChart } from "@/components/portal/bar-chart";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DynamicHeatmap } from "@/components/maps/dynamic-heatmap";
import { adminApi } from "@/lib/api/admin";

const KPI_DEFS = [
  { key: "total_reports", label: "Total Reports", icon: "description" },
  { key: "active_cases", label: "Active Cases", icon: "bolt" },
  { key: "closed_cases", label: "Closed Cases", icon: "task_alt" },
  { key: "registered_ngos", label: "NGOs", icon: "corporate_fare" },
  { key: "registered_volunteers", label: "Volunteers", icon: "group" },
  { key: "active_users", label: "Active Users", icon: "person" },
  { key: "pending_verifications", label: "Pending Verifications", icon: "pending" },
] as const;

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: adminApi.dashboard,
  });

  return (
    <>
      <ShellPageHeader
        title="Platform Dashboard"
        description="System-wide metrics and activity."
        action={
          <div className="flex gap-2">
            <Button href="/admin/ngos" size="sm" leadingIcon="add_business">
              Create NGO
            </Button>
            <Button href="/admin/announcements" size="sm" variant="outline" leadingIcon="campaign">
              Announce
            </Button>
          </div>
        }
      />

      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        <div className="grid grid-cols-2 gap-gutter md:grid-cols-4 lg:grid-cols-7">
          {KPI_DEFS.map((kpi) => (
            <Card key={kpi.key} className="flex flex-col gap-2 p-stack-md">
              <div className="flex items-center justify-between">
                <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{kpi.label}</span>
                <Icon name={kpi.icon} className="text-[18px] text-secondary" />
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <span className="text-headline-md font-bold text-primary">{data?.kpis[kpi.key] ?? 0}</span>
              )}
            </Card>
          ))}
        </div>

        <div className="grid gap-gutter lg:grid-cols-2">
          <Card className="flex flex-col gap-4 p-stack-md">
            <h2 className="text-headline-sm text-primary">Reports (14d)</h2>
            {isLoading ? <Skeleton className="h-40 w-full" /> : <BarChart data={data?.report_trend ?? []} accent="secondary" />}
          </Card>
          <Card className="flex flex-col gap-4 p-stack-md">
            <h2 className="text-headline-sm text-primary">User Growth</h2>
            {isLoading ? <Skeleton className="h-40 w-full" /> : <BarChart data={data?.user_growth ?? []} accent="primary" />}
          </Card>
          <Card className="flex flex-col gap-4 p-stack-md">
            <h2 className="text-headline-sm text-primary">National Rescue Map</h2>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (data?.heatmap.length ?? 0) > 0 ? (
              <DynamicHeatmap points={data!.heatmap.map((h) => ({ ...h, weight: (h as { weight?: number }).weight ?? 1 }))} />
            ) : (
              <div className="flex h-56 items-center justify-center text-label-sm text-on-surface-variant">No location data</div>
            )}
          </Card>
          <Card className="flex flex-col gap-3 p-stack-md">
            <h2 className="text-headline-sm text-primary">Recent Registrations</h2>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="flex flex-col divide-y divide-outline-variant">
                {data?.recent_registrations.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-label-md text-primary">{u.name}</p>
                      <p className="text-label-sm capitalize text-on-surface-variant">{u.role}</p>
                    </div>
                    <span className="text-label-sm text-on-surface-variant">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
