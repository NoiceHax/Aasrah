import { cn } from "@/lib/utils";

type CardProps = {
  as?: React.ElementType;
  className?: string;
  interactive?: boolean;
  glass?: boolean;
  children: React.ReactNode;
};

/**
 * Surface card. Depth comes from a 1px border (tonal layering), not shadows.
 * `interactive` adds a subtle hover lift; `glass` is for floating overlays.
 */
export function Card({
  as: Tag = "div",
  className,
  interactive = false,
  glass = false,
  children,
}: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-lg",
        glass
          ? "glass-panel"
          : "border border-outline-variant bg-surface-container-lowest",
        interactive && "transition-shadow hover:shadow-raised",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
