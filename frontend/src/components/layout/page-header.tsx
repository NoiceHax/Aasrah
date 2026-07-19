import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
};

/** Standard inner-page hero band on the primary navy surface. */
export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <section className="relative overflow-hidden border-b border-outline-variant bg-primary text-on-primary">
      {/* subtle grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <Container className="relative py-16 md:py-20">
        <Reveal className="flex max-w-3xl flex-col gap-4">
          {eyebrow && (
            <span className="text-label-sm uppercase tracking-widest text-secondary-fixed-dim">
              {eyebrow}
            </span>
          )}
          <h1 className="text-headline-lg md:text-display-lg">{title}</h1>
          {description && (
            <p className="text-body-lg text-on-primary-container opacity-90">{description}</p>
          )}
          {children && <div className="mt-2">{children}</div>}
        </Reveal>
      </Container>
    </section>
  );
}
