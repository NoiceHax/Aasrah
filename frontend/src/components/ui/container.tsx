import { cn } from "@/lib/utils";

type ContainerProps = {
  as?: React.ElementType;
  size?: "content" | "wide";
  className?: string;
  children: React.ReactNode;
};

/** Centered max-width wrapper with responsive horizontal padding. */
export function Container({
  as: Tag = "div",
  size = "content",
  className,
  children,
}: ContainerProps) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full px-margin-mobile md:px-margin-desktop",
        size === "content" ? "max-w-content" : "max-w-container-max",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
