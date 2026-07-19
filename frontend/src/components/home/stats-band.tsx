"use client";

import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { StatCounter } from "@/components/ui/stat-counter";
import { statsApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

type StatDef = {
  id: string;
  label: string;
  accent: "secondary" | "tertiary" | "primary" | "success";
  value: (s: {
    total_reports: number;
    rescues_completed: number;
    verified_ngos: number;
    active_volunteers: number;
  }) => number;
};

// Real, live platform metrics. On a fresh deployment these are legitimately
// small. We show honest numbers rather than fabricated ones.
const STAT_DEFS: StatDef[] = [
  { id: "rescues", label: "Rescues Completed", accent: "secondary", value: (s) => s.rescues_completed },
  { id: "ngos", label: "Verified NGOs", accent: "tertiary", value: (s) => s.verified_ngos },
  { id: "volunteers", label: "Active Volunteers", accent: "success", value: (s) => s.active_volunteers },
  { id: "reports", label: "Reports Filed", accent: "primary", value: (s) => s.total_reports },
];

const accentBar: Record<string, string> = {
  secondary: "bg-secondary",
  tertiary: "bg-on-tertiary-container",
  primary: "bg-primary",
  success: "bg-success",
};

export function StatsBand() {
  const { data } = useQuery({ queryKey: ["public", "stats"], queryFn: statsApi.platform });

  return (
    <section className="relative -mt-12 pb-8">
      <Container size="wide">
        <div className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
          {STAT_DEFS.map((stat, i) => (
            <Reveal key={stat.id} index={i}>
              <Card interactive className="flex h-full flex-col gap-2 p-stack-lg">
                <span className="text-headline-lg-mobile font-bold text-primary md:text-headline-lg">
                  <StatCounter value={data ? stat.value(data) : 0} />
                </span>
                <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
                  {stat.label}
                </span>
                <div className={cn("mt-1 h-1 w-12 rounded-full", accentBar[stat.accent])} />
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
