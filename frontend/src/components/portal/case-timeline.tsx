import { Icon } from "@/components/ui/icon";
import type { CaseTimelineItem } from "@/lib/api/types";

export function CaseTimeline({ events }: { events: CaseTimelineItem[] }) {
  if (events.length === 0) {
    return <p className="text-body-sm text-on-surface-variant">No events yet.</p>;
  }
  // Most recent first.
  const ordered = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <ol className="relative flex flex-col gap-5 pl-2">
      <span
        aria-hidden
        className="absolute left-[11px] top-2 h-[calc(100%-1rem)] w-0.5 bg-outline-variant"
      />
      {ordered.map((e) => (
        <li key={e.id} className="relative flex gap-3">
          <span className="z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-on-secondary">
            <Icon name="check" className="text-[14px]" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-label-md font-semibold text-primary">{e.title}</p>
              <span className="text-label-sm text-on-surface-variant">
                {new Date(e.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
              {!e.is_public && (
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] uppercase text-on-surface-variant">
                  internal
                </span>
              )}
            </div>
            {e.description && (
              <p className="mt-0.5 text-body-sm text-on-surface-variant">{e.description}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
