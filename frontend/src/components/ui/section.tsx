import { cn } from "@/lib/utils";
import { Container } from "./container";

type SectionProps = {
  id?: string;
  className?: string;
  containerClassName?: string;
  size?: "content" | "wide";
  /** Tonal surface for the section band; container width is independent. */
  surface?: "default" | "low" | "lowest" | "primary";
  children: React.ReactNode;
};

const surfaces: Record<NonNullable<SectionProps["surface"]>, string> = {
  default: "bg-background text-on-background",
  low: "bg-surface-container-low text-on-background",
  lowest: "bg-surface-container-lowest text-on-background",
  primary: "bg-primary text-on-primary",
};

/** A full-width vertical band with a centered container inside. */
export function Section({
  id,
  className,
  containerClassName,
  size = "content",
  surface = "default",
  children,
}: SectionProps) {
  return (
    <section id={id} className={cn("py-16 md:py-24", surfaces[surface], className)}>
      <Container size={size} className={containerClassName}>
        {children}
      </Container>
    </section>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  invert?: boolean;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  invert = false,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            "text-label-sm uppercase tracking-widest",
            invert ? "text-secondary-fixed-dim" : "text-secondary",
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "text-headline-lg-mobile md:text-headline-lg",
          invert ? "text-on-primary" : "text-primary",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "max-w-2xl text-body-md",
            invert ? "text-on-primary-container" : "text-on-surface-variant",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
