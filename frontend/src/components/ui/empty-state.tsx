import { Icon } from "./icon";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/** Consistent empty / zero-data placeholder. */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        <Icon name={icon} className="text-[28px]" />
      </div>
      <h3 className="text-headline-sm text-primary">{title}</h3>
      {description && <p className="max-w-md text-body-sm text-on-surface-variant">{description}</p>}
      {actionLabel && (actionHref || onAction) && (
        <Button
          href={actionHref}
          onClick={onAction}
          variant="outline"
          size="sm"
          className="mt-1"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
