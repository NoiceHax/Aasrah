import { Section, SectionHeading } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";
import { howItWorks } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const accent: Record<string, string> = {
  secondary: "bg-secondary text-on-secondary",
  primary: "bg-primary text-on-primary",
  success: "bg-success text-white",
};

export function HowItWorks() {
  return (
    <Section surface="low">
      <SectionHeading
        eyebrow="The Process"
        title="How it Works"
        description="Our streamlined process ensures that help arrives exactly where it's needed, as quickly as possible."
      />
      <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
        {/* connecting line on desktop */}
        <div
          aria-hidden
          className="absolute left-1/2 top-8 hidden h-px w-2/3 -translate-x-1/2 bg-outline-variant md:block"
        />
        {howItWorks.map((step, i) => (
          <Reveal key={step.id} index={i} className="relative flex flex-col items-center text-center">
            <div
              className={cn(
                "mb-6 flex h-16 w-16 items-center justify-center rounded-full ring-8 ring-surface-container-low",
                accent[step.accent],
              )}
            >
              <Icon name={step.icon} className="text-[32px]" />
            </div>
            <h3 className="mb-2 text-headline-sm text-primary">
              {step.step}. {step.title}
            </h3>
            <p className="max-w-xs text-body-sm text-on-surface-variant">{step.description}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
