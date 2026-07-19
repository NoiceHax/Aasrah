"use client";

import { useQuery } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";

const severityStyle: Record<string, { icon: string; color: string }> = {
  warning: { icon: "warning", color: "text-warning" },
  info: { icon: "lightbulb", color: "text-secondary" },
};

interface NgoComparison {
  ngo_id: string;
  name: string;
  claimed: number;
  completed: number;
  completion_rate: number;
  avg_response_minutes: number | null;
}

export default function InsightsPage() {
  const { data: insights, isLoading } = useQuery({
    queryKey: ["admin", "insights"],
    queryFn: adminApi.insights,
  });

  const { data: comp } = useQuery<{ ngos: NgoComparison[] }>({
    queryKey: ["admin", "insights", "comparison"],
    queryFn: async () => {
      const { apiClient } = await import("@/lib/api/client");
      return (await apiClient.get("/admin/insights/ngo-comparison")).data;
    },
  });

  return (
    <>
      <ShellPageHeader title="Insights" description="Actionable intelligence from live platform data." />
      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        <div className="grid gap-gutter md:grid-cols-2">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
            : insights?.insights.map((ins) => {
                const s = severityStyle[ins.severity] ?? severityStyle.info;
                return (
                  <Card key={ins.kind} className="flex gap-3 p-stack-md">
                    <Icon name={s.icon} className={`text-[24px] ${s.color}`} filled />
                    <div>
                      <p className="text-label-md font-semibold text-primary">{ins.headline}</p>
                      <p className="mt-0.5 text-body-sm text-on-surface-variant">{ins.detail}</p>
                    </div>
                  </Card>
                );
              })}
        </div>

        {comp?.ngos && comp.ngos.length > 0 && (
          <Card className="overflow-hidden">
            <h2 className="p-stack-md text-headline-sm text-primary">NGO Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-y border-outline-variant bg-surface-container-low">
                    {["NGO", "Claimed", "Completed", "Completion", "Avg Response"].map((h) => (
                      <th key={h} className="px-4 py-2 text-label-sm uppercase tracking-wider text-on-surface-variant">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {comp.ngos.map((n) => (
                    <tr key={n.ngo_id}>
                      <td className="px-4 py-2 font-medium text-primary">{n.name}</td>
                      <td className="px-4 py-2 text-body-sm">{n.claimed}</td>
                      <td className="px-4 py-2 text-body-sm">{n.completed}</td>
                      <td className="px-4 py-2 text-body-sm">{Math.round(n.completion_rate * 100)}%</td>
                      <td className="px-4 py-2 text-body-sm">{n.avg_response_minutes != null ? `${n.avg_response_minutes}m` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
