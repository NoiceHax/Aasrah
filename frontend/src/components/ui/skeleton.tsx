import { cn } from "@/lib/utils";

/** Tonal shimmer placeholder used by route-level loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-container-high",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent",
        className,
      )}
    />
  );
}
