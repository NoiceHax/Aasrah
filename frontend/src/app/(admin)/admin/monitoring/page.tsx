"use client";

import { useQuery } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";

interface RouteMetric {
  requests: number;
  errors: number;
  avg_latency_ms: number;
}

export default function MonitoringPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "monitoring"],
    queryFn: adminApi.monitoring,
    refetchInterval: 5000,
  });

  const metrics = data?.metrics as
    | { total_requests: number; total_errors: number; routes: Record<string, RouteMetric> }
    | undefined;
  const jobs = data?.jobs as
    | { queued: number; workers: number; history_counts: Record<string, number> }
    | undefined;

  return (
    <>
      <ShellPageHeader title="System Monitoring" description="Live request metrics and background job health." />
      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        <div className="grid grid-cols-2 gap-gutter md:grid-cols-4">
          {[
            { label: "Total Requests", value: metrics?.total_requests },
            { label: "Total Errors", value: metrics?.total_errors },
            { label: "Job Workers", value: jobs?.workers },
            { label: "Jobs Queued", value: jobs?.queued },
          ].map((s) => (
            <Card key={s.label} className="flex flex-col gap-1 p-stack-md">
              <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{s.label}</span>
              {isLoading ? <Skeleton className="h-8 w-12" /> : (
                <span className="text-headline-md font-bold text-primary">{s.value ?? 0}</span>
              )}
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <h2 className="p-stack-md text-headline-sm text-primary">Endpoint Latency</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-y border-outline-variant bg-surface-container-low">
                  {["Route", "Requests", "Errors", "Avg Latency"].map((h) => (
                    <th key={h} className="px-4 py-2 text-label-sm uppercase tracking-wider text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {metrics && Object.entries(metrics.routes).map(([route, m]) => (
                  <tr key={route}>
                    <td className="px-4 py-2 font-mono text-label-sm text-primary">{route}</td>
                    <td className="px-4 py-2 text-body-sm">{m.requests}</td>
                    <td className="px-4 py-2 text-body-sm">{m.errors}</td>
                    <td className="px-4 py-2 text-body-sm">{m.avg_latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
