import { PageHeader } from "@/components/layout/page-header";
import { Container } from "@/components/ui/container";

export type LegalSection = { heading: string; body: string };

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <PageHeader eyebrow="Legal" title={title} description={`Last updated ${updated}`} />
      <Container size="content" className="py-16">
        <div className="mx-auto max-w-2xl">
          <p className="text-body-lg text-on-surface-variant">{intro}</p>
          <div className="mt-10 flex flex-col gap-8">
            {sections.map((s) => (
              <section key={s.heading} className="flex flex-col gap-2">
                <h2 className="text-headline-sm text-primary">{s.heading}</h2>
                <p className="text-body-md text-on-surface-variant">{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
