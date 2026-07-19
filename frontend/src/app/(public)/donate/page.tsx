"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Section, SectionHeading } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/ui/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { statsApi } from "@/lib/api/endpoints";

export default function DonatePage() {
  const { data: ngos, isLoading } = useQuery({
    queryKey: ["public", "ngos"],
    queryFn: statsApi.ngos,
  });

  return (
    <>
      <PageHeader
        eyebrow="Support the mission"
        title="Donate to a partner NGO"
        description="Every verified NGO on Aasrah runs its own operations and fundraising. Choose an organisation below and you'll be taken directly to their donation page."
      />

      <Section surface="default">
        <SectionHeading
          eyebrow="Our network"
          title="Verified partner NGOs"
          description="All organisations listed here are vetted and verified before joining the platform."
          className="max-w-2xl"
        />

        <div className="mt-10">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-52 w-full rounded-xl" />
              ))}
            </div>
          ) : ngos && ngos.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {ngos.map((ngo, i) => (
                <Reveal key={ngo.id} index={i}>
                  <Card className="flex h-full flex-col gap-4 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-fixed text-on-secondary-fixed-variant">
                        <Icon name="corporate_fare" className="text-[22px]" />
                      </div>
                      <Badge variant="info">
                        <Icon name="verified" className="mr-1 text-[13px]" filled />
                        Verified
                      </Badge>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-headline-sm text-primary">{ngo.name}</h3>
                      {ngo.focus_area && (
                        <p className="mt-1 text-body-sm text-on-surface-variant">{ngo.focus_area}</p>
                      )}
                    </div>

                    {ngo.location && (
                      <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                        <Icon name="location_on" className="text-[15px]" />
                        {ngo.location}
                      </div>
                    )}

                    <div className="mt-auto border-t border-outline-variant pt-4">
                      {ngo.website ? (
                        <Button
                          href={`${ngo.website.replace(/\/$/, "")}/donate`}
                          variant="secondary"
                          fullWidth
                          trailingIcon="open_in_new"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Donate to {ngo.name}
                        </Button>
                      ) : (
                        <p className="text-label-sm text-on-surface-variant">No donation page listed</p>
                      )}
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="volunteer_activism"
              title="No NGOs listed yet"
              description="Verified partner NGOs will appear here as they join the platform. Check back soon."
            />
          )}
        </div>
      </Section>

      <Section surface="low">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-fixed text-on-secondary-fixed-variant">
            <Icon name="info" className="text-[28px]" />
          </div>
          <h2 className="text-headline-md text-primary">How donations work</h2>
          <p className="mt-4 text-body-md text-on-surface-variant">
            Aasrah is the coordination platform: we connect people in need with NGOs and volunteers.
            Each NGO handles its own funding independently. Clicking &quot;Donate&quot; takes you directly
            to that organisation&apos;s website, outside of Aasrah. We do not process or hold any
            donations.
          </p>
        </div>
      </Section>
    </>
  );
}
