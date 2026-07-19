"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/portal/status-badge";
import { DynamicStaticMap } from "@/components/maps/dynamic-static-map";
import { cn } from "@/lib/utils";
import { reportsApi, resolveImageUrl } from "@/lib/api/endpoints";
import { normalizeError } from "@/lib/api/client";
import type { ReportTracking, TimelineState } from "@/lib/api/types";

const dotState: Record<TimelineState, string> = {
  complete: "bg-success text-white",
  active: "bg-secondary text-on-secondary animate-pulse-ring",
  upcoming: "border-2 border-outline-variant bg-surface-container-lowest text-outline",
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return "Pending";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function TrackLookup({ initialId }: { initialId?: string }) {
  const [reference, setReference] = useState(initialId ?? "");
  const [error, setError] = useState<string>();
  const [report, setReport] = useState<ReportTracking | null>(null);

  const mutation = useMutation({
    mutationFn: (trackingId: string) => reportsApi.track(trackingId),
    onSuccess: (data) => {
      setReport(data);
      setError(undefined);
    },
    onError: (e) => {
      setReport(null);
      const err = normalizeError(e);
      setError(
        err.status === 404
          ? "No report found with that tracking ID. Check the ID and try again."
          : err.message,
      );
    },
  });

  // Auto-run the lookup once when arriving with a prefilled ID (e.g. from the
  // report-success "Track This Report" link or a shared tracking link).
  const autoRan = useRef(false);
  useEffect(() => {
    const id = (initialId ?? "").trim().replace(/^#/, "");
    if (id && !autoRan.current) {
      autoRan.current = true;
      mutation.mutate(id);
    }
  }, [initialId, mutation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reference.trim().replace(/^#/, "");
    if (!trimmed) {
      setError("Enter the reference ID from your report");
      return;
    }
    setError(undefined);
    mutation.mutate(trimmed);
  };

  return (
    <div className="flex flex-col gap-8">
      <Card className="p-stack-lg">
        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <Input
            name="reference"
            label="Report reference ID"
            placeholder="e.g. AR-9402"
            leadingIcon="tag"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            error={error}
            className="flex-1"
          />
          <Button
            type="submit"
            size="lg"
            leadingIcon={mutation.isPending ? undefined : "search"}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Searching…" : "Track Report"}
          </Button>
        </form>
      </Card>

      {report && (
        <Card className="animate-fade-up p-stack-lg">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-5">
            <div>
              <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">Case</p>
              <h2 className="text-headline-sm text-primary">#{report.tracking_id}</h2>
            </div>
            <StatusBadge status={report.status} />
          </div>

          {/* Summary */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                Submitted
              </p>
              <p className="text-body-md text-primary">{formatTimestamp(report.created_at)}</p>
            </div>
            {report.address && (
              <div>
                <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  Location
                </p>
                <p className="text-body-md text-primary">{report.address}</p>
              </div>
            )}
          </div>

          {report.description && (
            <p className="mb-6 rounded-lg bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
              {report.description}
            </p>
          )}

          {/* Images */}
          {report.images.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
                Photos
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {report.images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img.id}
                    src={resolveImageUrl(img.url)}
                    alt="Report attachment"
                    className="aspect-square w-full rounded-md border border-outline-variant object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          {report.latitude != null && report.longitude != null && (
            <div className="mb-6">
              <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
                Map
              </p>
              <DynamicStaticMap lat={report.latitude} lng={report.longitude} />
            </div>
          )}

          {/* Timeline */}
          <p className="mb-4 text-label-sm uppercase tracking-wider text-on-surface-variant">
            Rescue timeline
          </p>
          <ol className="relative flex flex-col gap-6 pl-2">
            <span
              aria-hidden
              className="absolute left-[15px] top-2 h-[calc(100%-1rem)] w-0.5 bg-outline-variant"
            />
            {report.timeline.map((step) => (
              <li key={step.key} className="relative flex gap-4">
                <span
                  className={cn(
                    "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    dotState[step.state],
                  )}
                >
                  <Icon
                    name={
                      step.state === "complete"
                        ? "check"
                        : step.state === "active"
                          ? "sync"
                          : "circle"
                    }
                    className={step.state === "upcoming" ? "text-[8px]" : "text-[18px]"}
                  />
                </span>
                <div className="pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-label-md font-semibold text-primary">{step.title}</p>
                    {step.timestamp && (
                      <span className="text-label-sm text-on-surface-variant">
                        · {formatTimestamp(step.timestamp)}
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="mt-0.5 text-body-sm text-on-surface-variant">
                      {step.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
