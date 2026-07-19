"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalPageHeader } from "@/components/portal/portal-shell";
import { StatusBadge, PriorityBadge } from "@/components/portal/status-badge";
import { CaseTimeline } from "@/components/portal/case-timeline";
import { CaseNotes } from "@/components/portal/case-notes";
import { CaseAssignments } from "@/components/portal/case-assignments";
import { AiPanel } from "@/components/portal/ai-panel";
import { DuplicatesPanel } from "@/components/portal/duplicates-panel";
import { CaseAttachments } from "@/components/portal/case-attachments";
import { DynamicStaticMap } from "@/components/maps/dynamic-static-map";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/notifications/toast";
import { ngoApi } from "@/lib/api/ngo";
import { resolveImageUrl } from "@/lib/api/endpoints";
import { normalizeError } from "@/lib/api/client";
import { nextStatuses, STATUS_LABELS } from "@/lib/rescue-workflow";
import type { ReportStatus } from "@/lib/api/types";

type Tab = "overview" | "timeline" | "volunteers" | "notes" | "attachments";

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: c, isLoading, isError, error } = useQuery({
    queryKey: ["ngo", "case", id],
    queryFn: () => ngoApi.getCase(id),
    retry: false,
  });

  const statusMutation = useMutation({
    mutationFn: (status: ReportStatus) => ngoApi.updateStatus(id, status),
    onSuccess: (updated) => {
      toast.success("Status updated", STATUS_LABELS[updated.status]);
      qc.invalidateQueries({ queryKey: ["ngo", "case", id] });
      qc.invalidateQueries({ queryKey: ["ngo", "dashboard"] });
    },
    onError: (e) => toast.error("Couldn't update status", normalizeError(e).message),
  });

  if (isLoading) {
    return (
      <>
        <PortalPageHeader title="Case" />
        <div className="space-y-4 p-margin-mobile md:p-margin-desktop">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (isError || !c) {
    const norm = normalizeError(error);
    const { title, description } =
      norm.status === 404
        ? { title: "Case not found", description: "This report may have been removed, or the ID is incorrect." }
        : norm.status === 403
          ? { title: "You can't view this case", description: norm.message }
          : { title: "Couldn't load this case", description: norm.message };
    return (
      <>
        <PortalPageHeader title="Case" />
        <div className="p-margin-mobile md:p-margin-desktop">
          <EmptyState
            icon={norm.status === 403 ? "lock" : "error_outline"}
            title={title}
            description={description}
            actionLabel="Back to cases"
            actionHref="/portal/cases"
          />
        </div>
      </>
    );
  }

  const transitions = nextStatuses(c.status);
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "info" },
    { key: "timeline", label: "Timeline", icon: "timeline" },
    { key: "volunteers", label: "Volunteers", icon: "group" },
    { key: "notes", label: "Notes", icon: "sticky_note_2" },
    { key: "attachments", label: "Attachments", icon: "attach_file" },
  ];

  return (
    <>
      <PortalPageHeader
        title={`Case #${c.tracking_id}`}
        description={c.address ?? "No address provided"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            {transitions.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === "rejected" ? "danger" : "primary"}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(s)}
              >
                {STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        }
      />

      <div className="p-margin-mobile md:p-margin-desktop">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-outline-variant">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-label-md transition-colors ${
                tab === t.key
                  ? "border-secondary font-semibold text-secondary"
                  : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              <Icon name={t.icon} className="text-[18px]" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid gap-gutter lg:grid-cols-3">
            <div className="space-y-gutter lg:col-span-2">
              <Card className="p-stack-md">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={c.priority} />
                  <span className="text-label-md capitalize text-on-surface-variant">{c.situation}</span>
                  {c.children_present && (
                    <span className="flex items-center gap-1 text-label-sm text-warning">
                      <Icon name="child_care" className="text-[16px]" /> Children present
                    </span>
                  )}
                  {c.distance_km != null && (
                    <span className="text-label-sm text-on-surface-variant">{c.distance_km} km away</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-body-md text-on-surface">{c.description}</p>
              </Card>

              {c.images.length > 0 && (
                <Card className="p-stack-md">
                  <h3 className="mb-3 text-headline-sm text-primary">Photos</h3>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {c.images.map((img) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={img.id}
                        src={resolveImageUrl(img.url)}
                        alt="Report"
                        className="aspect-square w-full rounded-md border border-outline-variant object-cover"
                      />
                    ))}
                  </div>
                </Card>
              )}

              {c.latitude != null && c.longitude != null && (
                <Card className="p-stack-md">
                  <h3 className="mb-3 text-headline-sm text-primary">Location</h3>
                  <DynamicStaticMap lat={c.latitude} lng={c.longitude} />
                  <p className="mt-2 text-label-sm text-on-surface-variant">
                    {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}
                  </p>
                </Card>
              )}
            </div>

            <div className="space-y-gutter">
              <AiPanel caseData={c} />
              {c.claimed_by_ngo_id && <DuplicatesPanel reportId={c.id} />}
              <Card className="p-stack-md">
                <h3 className="mb-3 text-headline-sm text-primary">Reporter</h3>
                {c.reporter_name || c.reporter_phone ? (
                  <div className="flex flex-col gap-2 text-body-sm">
                    {c.reporter_name && (
                      <span className="flex items-center gap-2">
                        <Icon name="person" className="text-[18px] text-on-surface-variant" />
                        {c.reporter_name}
                      </span>
                    )}
                    {c.reporter_phone && (
                      <a href={`tel:${c.reporter_phone}`} className="flex items-center gap-2 text-secondary hover:underline">
                        <Icon name="call" className="text-[18px]" />
                        {c.reporter_phone}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-body-sm text-on-surface-variant">Anonymous report.</p>
                )}
              </Card>

              <Card className="p-stack-md">
                <h3 className="mb-3 text-headline-sm text-primary">Details</h3>
                <dl className="flex flex-col gap-2 text-label-md">
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant">Submitted</dt>
                    <dd className="text-primary">{new Date(c.created_at).toLocaleString()}</dd>
                  </div>
                  {c.claimed_at && (
                    <div className="flex justify-between">
                      <dt className="text-on-surface-variant">Claimed</dt>
                      <dd className="text-primary">{new Date(c.claimed_at).toLocaleString()}</dd>
                    </div>
                  )}
                  {c.people_count != null && (
                    <div className="flex justify-between">
                      <dt className="text-on-surface-variant">People</dt>
                      <dd className="text-primary">{c.people_count}</dd>
                    </div>
                  )}
                </dl>
              </Card>
            </div>
          </div>
        )}

        {tab === "timeline" && (
          <Card className="max-w-2xl p-stack-md">
            <CaseTimeline events={c.timeline} />
          </Card>
        )}
        {tab === "volunteers" && (
          <Card className="max-w-2xl p-stack-md">
            <CaseAssignments reportId={id} />
          </Card>
        )}
        {tab === "notes" && (
          <Card className="max-w-2xl p-stack-md">
            <CaseNotes reportId={id} />
          </Card>
        )}
        {tab === "attachments" && (
          <Card className="max-w-3xl p-stack-md">
            <CaseAttachments reportId={id} />
          </Card>
        )}
      </div>
    </>
  );
}
