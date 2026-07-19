import { cn } from "@/lib/utils";

type BadgeVariant =
  | "neutral"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  secondary: "bg-secondary-fixed text-on-secondary-fixed-variant",
  success: "bg-success-soft text-on-success-soft",
  warning: "bg-warning-soft text-on-warning-soft",
  danger: "bg-danger-soft text-on-danger-soft",
  info: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
};

type BadgeProps = {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
};

/** Pill-shaped soft status badge (design-md: fully rounded, soft variants). */
export function Badge({ variant = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
