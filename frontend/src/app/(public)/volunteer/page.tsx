import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Section, SectionHeading } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { volunteerRoles } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Volunteer",
  description:
    "Join a network of volunteers responding to humanitarian cases. Explore roles (field responder, dispatch coordinator, medical volunteer, translator) and apply today.",
};

export default function VolunteerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Get involved"
        title="Volunteer with Aasrah"
        description="Whether you can respond in the field or coordinate from home, there's a role for you. Every shift moves someone closer to safety."
      />

      <Section surface="default">
        <SectionHeading
          eyebrow="Find your role"
          title="Ways to help"
          description="Choose how you want to contribute. All roles include onboarding and ongoing support."
        />
        <div className="mt-12 grid gap-gutter sm:grid-cols-2">
          {volunteerRoles.map((role, i) => (
            <Reveal key={role.id} index={i}>
              <Card interactive className="flex h-full flex-col gap-4 p-stack-md">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant">
                    <Icon name={role.icon} className="text-[24px]" />
                  </div>
                  <Badge variant="neutral">{role.commitment}</Badge>
                </div>
                <div>
                  <h3 className="text-headline-sm text-primary">{role.title}</h3>
                  <p className="mt-1 text-body-sm text-on-surface-variant">{role.description}</p>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 border-t border-outline-variant pt-4">
                  {role.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-label-sm text-on-surface-variant"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section surface="low" id="apply">
        <Container size="content" className="px-0">
          <div className="mx-auto max-w-2xl text-center">
            <SectionHeading
              eyebrow="Apply"
              title="Ready to help?"
              description="Create a volunteer account to get started. Applications are reviewed by our team, and once approved you'll be able to accept rescue assignments, either independently or with a preferred NGO."
            />
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href={routes.register} size="lg" leadingIcon="volunteer_activism">
                Apply as a Volunteer
              </Button>
              <Button href={routes.login} size="lg" variant="outline">
                I already have an account
              </Button>
            </div>
            <p className="mt-6 text-body-sm text-on-surface-variant">
              During onboarding you can add your skills, languages, availability, working radius,
              and emergency contact.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
