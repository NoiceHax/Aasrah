"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { useToast } from "@/components/notifications/toast";

type ReportSuccessProps = {
  trackingId: string;
  onReset?: () => void;
};

/**
 * The post-submission experience for a report. The Report ID is the primary
 * focus: it is large, copyable, and paired with a copyable tracking link and a
 * direct "Track This Report" action. A prominent reminder encourages the user
 * to screenshot the page. We do not (and cannot reliably) capture the screen
 * for them; this is a manual-save nudge only.
 */
export function ReportSuccess({ trackingId, onReset }: ReportSuccessProps) {
  const toast = useToast();
  const [copied, setCopied] = useState<"id" | "link" | null>(null);

  const trackHref = `${routes.track}?id=${encodeURIComponent(trackingId)}`;
  const trackingLink =
    typeof window !== "undefined" ? `${window.location.origin}${trackHref}` : trackHref;

  const copy = async (value: string, which: "id" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      toast.success(
        which === "id" ? "Report ID copied" : "Tracking link copied",
        "Keep it somewhere safe so you can check back later.",
      );
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      toast.warning("Couldn't copy automatically", "Please copy it manually.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-on-success-soft">
        <Icon name="check_circle" className="text-[40px]" filled />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-headline-sm text-primary">Report received</h3>
        <p className="max-w-md text-body-md text-on-surface-variant">
          Thank you. Our coordination team will review the details and route this
          to a verified NGO. Use the Report ID below to follow its progress.
        </p>
      </div>

      {/* Primary focus: the Report ID */}
      <div className="w-full max-w-md rounded-xl border-2 border-primary/30 bg-surface-container-low p-6">
        <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
          Your Report ID
        </span>
        <p className="mt-1 select-all font-mono text-headline-lg font-extrabold tracking-tight text-primary">
          {trackingId}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            size="sm"
            leadingIcon={copied === "id" ? "check" : "content_copy"}
            onClick={() => copy(trackingId, "id")}
          >
            {copied === "id" ? "Copied" : "Copy Report ID"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={copied === "link" ? "check" : "link"}
            onClick={() => copy(trackingLink, "link")}
          >
            {copied === "link" ? "Copied" : "Copy Tracking Link"}
          </Button>
        </div>
      </div>

      {/* Highly visible save reminder */}
      <div
        role="note"
        className="flex w-full max-w-md items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft/60 p-4 text-left"
      >
        <Icon name="photo_camera" className="mt-0.5 shrink-0 text-[22px] text-on-warning-soft" filled />
        <div>
          <p className="text-body-md font-bold text-on-surface">
            Take a screenshot of this page to save your Report ID for future tracking.
          </p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Anonymous reports aren&apos;t tied to an account, so this ID is the only
            way to look up your report later. Save it now.
          </p>
        </div>
      </div>

      {/* Guide the user toward tracking */}
      <Button href={trackHref} size="lg" leadingIcon="travel_explore" fullWidth className="max-w-md">
        Track This Report
      </Button>

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="text-body-sm font-semibold text-secondary hover:underline"
        >
          Submit another report
        </button>
      )}
    </div>
  );
}
