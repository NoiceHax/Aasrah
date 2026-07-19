"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Section, SectionHeading } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { statsApi } from "@/lib/api/endpoints";
import { siteConfig } from "@/lib/site-config";
import { routes } from "@/lib/routes";

export default function ContactPage() {
  const { data: ngos, isLoading } = useQuery({
    queryKey: ["public", "ngos"],
    queryFn: statsApi.ngos,
  });

  return (
    <>
      <PageHeader
        eyebrow="Get in touch"
        title="Contact & Support"
        description="For technical issues with the platform, reach the developer directly. For NGO-related queries, contact the relevant organisation."
      />

      {/* Developer contact */}
      <Section surface="default">
        <div className="mx-auto max-w-2xl">
          <SectionHeading
            eyebrow="Technical support"
            title="Developer's email"
            description="Reach out for bugs, platform errors, account access issues, or anything technical related to the Aasrah platform itself."
          />

          <div className="mt-8 flex flex-col gap-4">
            <a href={`mailto:${siteConfig.developerEmail}`} className="block">
              <Card interactive className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-fixed text-on-secondary-fixed-variant">
                  <Icon name="mail" className="text-[22px]" />
                </div>
                <div className="flex-1">
                  <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">Developer&apos;s email</p>
                  <p className="text-body-md font-medium text-primary">{siteConfig.developerEmail}</p>
                </div>
                <Icon name="open_in_new" className="text-[18px] text-on-surface-variant" />
              </Card>
            </a>

            <Card className="flex items-start gap-4 border-warning/40 bg-warning/5 p-5">
              <Icon name="info" className="mt-0.5 text-[20px] text-warning" />
              <div>
                <p className="text-label-md font-semibold text-primary">This email is for technical issues only</p>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Questions about ongoing rescue cases, volunteer assignments, NGO operations, donations,
                  or anything field-related should be directed to the relevant NGO, not to this address.
                  The developer is not part of any NGO&apos;s operations.
                </p>
              </div>
            </Card>

            <div className="mt-2 rounded-lg border border-outline-variant bg-surface-container-low p-4">
              <p className="text-label-sm font-semibold text-primary">What counts as a technical issue?</p>
              <ul className="mt-2 flex flex-col gap-1 text-body-sm text-on-surface-variant">
                {[
                  "Can't log in or access your account",
                  "Platform displaying errors or not loading",
                  "Report submission or tracking not working",
                  "Data appearing incorrectly on the platform",
                  "Security concerns or suspected misuse of the platform",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Icon name="check_circle" className="mt-0.5 text-[15px] text-success" filled />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* NGO contact directory */}
      <Section surface="low">
        <SectionHeading
          eyebrow="NGO support"
          title="Contact a partner NGO"
          description="For questions about an active case, volunteering with a specific organisation, or making donations, contact the NGO directly."
        />

        <div className="mt-10">
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
            </div>
          ) : ngos && ngos.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ngos.map((ngo, i) => (
                <Reveal key={ngo.id} index={i}>
                  <Card className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                        <Icon name="corporate_fare" className="text-[18px]" />
                      </div>
                      <Badge variant="info">
                        <Icon name="verified" className="mr-1 text-[12px]" filled />
                        Verified
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-label-md font-semibold text-primary">{ngo.name}</h3>
                      {ngo.focus_area && (
                        <p className="text-body-sm text-on-surface-variant">{ngo.focus_area}</p>
                      )}
                      {ngo.location && (
                        <p className="mt-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
                          <Icon name="location_on" className="text-[14px]" />
                          {ngo.location}
                        </p>
                      )}
                    </div>
                    <div className="mt-auto border-t border-outline-variant pt-3 flex gap-2">
                      {ngo.website ? (
                        <>
                          <Button
                            href={ngo.website}
                            variant="outline"
                            size="sm"
                            trailingIcon="open_in_new"
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Website
                          </Button>
                          <Button
                            href={`${ngo.website.replace(/\/$/, "")}/contact`}
                            variant="ghost"
                            size="sm"
                            trailingIcon="open_in_new"
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Contact page
                          </Button>
                        </>
                      ) : (
                        <p className="text-label-sm text-on-surface-variant">No website listed</p>
                      )}
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="corporate_fare"
              title="No NGOs listed yet"
              description="Partner NGO contact pages will appear here as organisations join the platform."
            />
          )}
        </div>

        <div className="mt-10 flex justify-center">
          <Button href={routes.faq} variant="outline" leadingIcon="help" trailingIcon="arrow_forward">
            Browse frequently asked questions
          </Button>
        </div>
      </Section>
    </>
  );
}
