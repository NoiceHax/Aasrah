import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Section, SectionHeading } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";
import { CallToAction } from "@/components/home/cta";
import { values, howItWorks } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "About",
  description:
    "Aasrah builds the digital infrastructure for humanitarian response and community-led care. Learn about our mission and the principles behind the platform.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our mission"
        title="Infrastructure for human kindness"
        description="Aasrah exists to make sure no call for help goes unanswered. We connect the public, verified NGOs, and volunteers on a single, transparent platform built for controlled urgency."
      />

      {/* Mission */}
      <Section surface="default">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal className="flex flex-col gap-4">
            <SectionHeading
              align="left"
              eyebrow="Why we exist"
              title="Help, coordinated and accountable"
              description="The humanitarian sector runs on goodwill but is often slowed by fragmented tools. Aasrah replaces spreadsheets and group chats with a purpose-built operational backbone, so responders spend their energy on people, not paperwork."
            />
            <p className="text-body-md text-on-surface-variant">
              Every report is auditable end to end. Every NGO is verified. Every status color means
              exactly one thing. That clarity is what lets teams act decisively when minutes matter.
            </p>
          </Reveal>

          <Reveal index={1} className="flex flex-col gap-4">
            {howItWorks.map((step) => (
              <Card key={step.id} className="flex items-start gap-4 p-stack-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant">
                  <Icon name={step.icon} />
                </div>
                <div>
                  <h3 className="text-label-md font-semibold text-on-surface">{step.title}</h3>
                  <p className="text-body-sm text-on-surface-variant">{step.description}</p>
                </div>
              </Card>
            ))}
          </Reveal>
        </div>
      </Section>

      {/* Values */}
      <Section surface="low">
        <SectionHeading
          eyebrow="What we stand for"
          title="Our values"
          description="Four principles shape every decision, from product design to partner vetting."
        />
        <div className="mt-12 grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v, i) => (
            <Reveal key={v.id} index={i}>
              <Card interactive className="flex h-full flex-col gap-3 p-stack-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant">
                  <Icon name={v.icon} />
                </div>
                <h3 className="text-headline-sm text-primary">{v.title}</h3>
                <p className="text-body-sm text-on-surface-variant">{v.description}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      <CallToAction />
    </>
  );
}
