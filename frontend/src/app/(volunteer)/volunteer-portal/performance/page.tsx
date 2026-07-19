"use client";

import { useQuery } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { volunteerApi } from "@/lib/api/volunteer";

export default function PerformancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["volunteer", "performance"],
    queryFn: volunteerApi.performance,
  });

  const stats = data
    ? [
        { label: "Total Rescues", value: data.total_rescues, icon: "task_alt" },
        { label: "This Month", value: data.monthly_rescues, icon: "calendar_month" },
        { label: "Acceptance Rate", value: `${Math.round(data.acceptance_rate * 100)}%`, icon: "thumb_up" },
        { label: "Hours Volunteered", value: data.total_hours, icon: "timer" },
        {
          label: "Avg. Response",
          value: data.avg_response_minutes != null ? `${data.avg_response_minutes}m` : "-",
          icon: "bolt",
        },
      ]
    : [];

  return (
    <>
      <ShellPageHeader title="Performance" description="Your impact and recognition." />
      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        <div className="grid grid-cols-2 gap-gutter lg:grid-cols-5">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
            : stats.map((s) => (
                <Card key={s.label} className="flex flex-col gap-2 p-stack-md">
                  <div className="flex items-center justify-between">
                    <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{s.label}</span>
                    <Icon name={s.icon} className="text-[20px] text-secondary" />
                  </div>
                  <span className="text-headline-md font-bold text-primary">{s.value}</span>
                </Card>
              ))}
        </div>

        <Card className="p-stack-md">
          <h2 className="mb-4 text-headline-sm text-primary">Recognition Badges</h2>
          {data && data.badges.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {data.badges.map((b) => (
                <div
                  key={b}
                  className="flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary-fixed px-4 py-2 text-on-secondary-fixed-variant"
                >
                  <Icon name="military_tech" className="text-[20px]" filled />
                  <span className="text-label-md font-semibold">{b}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-body-sm text-on-surface-variant">
              Complete rescues to earn recognition badges.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
