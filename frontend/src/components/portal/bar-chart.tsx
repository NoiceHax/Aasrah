import { cn } from "@/lib/utils";
import type { TimeSeriesPoint } from "@/lib/api/types";

/** Minimal dependency-free bar chart for dashboard/analytics. */
export function BarChart({
  data,
  className,
  accent = "secondary",
}: {
  data: TimeSeriesPoint[];
  className?: string;
  accent?: "secondary" | "success" | "primary";
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barColor =
    accent === "success" ? "bg-success" : accent === "primary" ? "bg-primary" : "bg-secondary";

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-label-sm text-on-surface-variant">
        No data yet
      </div>
    );
  }

  return (
    <div className={cn("flex h-40 items-end gap-2", className)}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className={cn("w-full rounded-t-sm transition-all", barColor)}
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? "4px" : "0" }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="truncate text-[10px] text-on-surface-variant">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
