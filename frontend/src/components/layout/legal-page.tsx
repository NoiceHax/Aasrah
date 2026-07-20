import { PageHeader } from "@/components/layout/page-header";
import { Container } from "@/components/ui/container";

/**
 * `body` accepts either a paragraph or a list of bullet points. Passing a
 * string renders a single <p>; passing an array renders a <ul>.
 */
export type LegalSection = { heading: string; body: string | string[] };

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
                {Array.isArray(s.body) ? (
                  <ul className="flex list-disc flex-col gap-2 pl-5 text-body-md text-on-surface-variant marker:text-primary">
                    {s.body.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body-md text-on-surface-variant">{s.body}</p>
                )}
              </section>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
