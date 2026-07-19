"use client";

import { useQuery } from "@tanstack/react-query";
import { Section, SectionHeading } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { statsApi } from "@/lib/api/endpoints";
import { routes } from "@/lib/routes";

export function NgoShowcase() {
  const { data: ngos, isLoading } = useQuery({
    queryKey: ["public", "ngos"],
    queryFn: statsApi.ngos,
  });

  return (
    <Section surface="default">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <SectionHeading
          align="left"
          eyebrow="Our network"
          title="Verified NGOs, ready to respond"
          description="Every partner is vetted before they can claim a case, so help is always credentialed."
          className="max-w-2xl"
        />
        <Button href={routes.about} variant="outline" trailingIcon="arrow_forward">
          Learn more
        </Button>
      </div>

      <div className="mt-12">
        {isLoading ? (
          <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : ngos && ngos.length > 0 ? (
          <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
            {ngos.map((ngo, i) => (
              <Reveal key={ngo.id} index={i}>
                <Card interactive className="flex h-full flex-col gap-4 p-stack-md">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                      <Icon name="corporate_fare" />
                    </div>
                    <Badge variant="info">
                      <Icon name="verified" className="mr-1 text-[14px]" filled />
                      Verified
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-headline-sm text-primary">{ngo.name}</h3>
                    {ngo.focus_area && (
                      <p className="text-body-sm text-on-surface-variant">{ngo.focus_area}</p>
                    )}
                  </div>
                  {ngo.location && (
                    <div className="mt-auto flex items-center gap-2 border-t border-outline-variant pt-4 text-label-sm text-on-surface-variant">
                      <Icon name="location_on" className="text-[16px]" />
                      {ngo.location}
                    </div>
                  )}
                </Card>
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="corporate_fare"
            title="Our partner network is growing"
            description="Verified NGOs will appear here as they join the platform."
          />
        )}
      </div>
    </Section>
  );
}
