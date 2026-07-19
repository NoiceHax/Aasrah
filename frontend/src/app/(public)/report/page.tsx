import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/layout/page-header";
import { ReportForm } from "@/components/forms/report-form";
import { howItWorks } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Report a Person",
  description:
    "Report a person in need of urgent humanitarian assistance. Provide a location and details, and a verified NGO will be dispatched.",
};

export default function ReportPage() {
  return (
    <>
      <PageHeader
        eyebrow="Help a Person"
        title="Report someone who needs help"
        description="Share a location and what you've observed. Our coordination team verifies every report and routes it to the nearest verified NGO."
      />

      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
          <div>
            <ReportForm />
          </div>

          <aside className="flex flex-col gap-6">
            <Card className="p-stack-md">
              <h2 className="mb-4 text-headline-sm text-primary">What happens next</h2>
              <ol className="flex flex-col gap-4">
                {howItWorks.map((step) => (
                  <li key={step.id} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-fixed text-label-md font-bold text-on-secondary-fixed-variant">
                      {step.step}
                    </span>
                    <div>
                      <p className="text-label-md font-semibold text-primary">{step.title}</p>
                      <p className="text-label-sm text-on-surface-variant">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>

            <Card glass className="p-stack-md">
              <div className="flex items-start gap-3">
                <Icon name="shield" className="text-[24px] text-secondary" filled />
                <div>
                  <p className="text-label-md font-semibold text-primary">Your privacy</p>
                  <p className="mt-1 text-label-sm text-on-surface-variant">
                    Reports can be filed anonymously. Personal details are shared only with the
                    verified NGO that claims the case.
                  </p>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </Container>
    </>
  );
}
