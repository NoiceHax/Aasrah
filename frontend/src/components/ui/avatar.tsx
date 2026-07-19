import { cn } from "@/lib/utils";

type AvatarProps = {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-8 w-8 text-label-sm",
  md: "h-12 w-12 text-label-md",
  lg: "h-16 w-16 text-headline-sm",
};

/** Circular initials avatar. Neutral placeholder for people across the site. */
export function Avatar({ initials, size = "md", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-on-primary",
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
