"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/notifications/toast";
import { ngoApi } from "@/lib/api/ngo";
import { normalizeError } from "@/lib/api/client";
import type { CaseDetail } from "@/lib/api/types";

const ANALYSIS_FLAGS: { key: keyof NonNullable<CaseDetail["ai_analysis"]>; label: string }[] = [
  { key: "children_present", label: "Children present" },
  { key: "visible_injuries", label: "Visible injuries" },
  { key: "needs_medical", label: "Needs medical" },
  { key: "needs_food_or_shelter", label: "Needs food/shelter" },
];

/** AI-assist panel on the case detail: summary, analysis (with override), priority. */
export function AiPanel({ caseData }: { caseData: CaseDetail }) {
  const toast = useToast();
  const qc = useQueryClient();
  const analysis = caseData.ai_analysis ?? {};

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ngo", "case", caseData.id] });

  const overrideFlag = useMutation({
    mutationFn: (fields: Record<string, unknown>) => ngoApi.overrideAnalysis(caseData.id, fields),
    onSuccess: () => {
      toast.success("Analysis updated");
      invalidate();
    },
    onError: (e) => toast.error("Couldn't update", normalizeError(e).message),
  });

  return (
    <Card className="p-stack-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-headline-sm text-primary">
          <Icon name="auto_awesome" className="text-[20px] text-secondary" filled />
          AI Assist
        </h3>
        <Badge variant={analysis.source === "ai" ? "info" : "neutral"}>
          {analysis.source === "ai" ? "AI" : analysis.source === "ngo_override" ? "Reviewed" : "Heuristic"}
        </Badge>
      </div>

      {caseData.ai_summary && (
        <p className="mb-4 rounded-lg bg-secondary-fixed/40 p-3 text-body-sm italic text-on-secondary-fixed-variant">
          &ldquo;{caseData.ai_summary}&rdquo;
        </p>
      )}

      {caseData.priority_score != null && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-outline-variant p-3">
          <span className="text-label-md text-on-surface-variant">Priority score</span>
          <span className="text-headline-sm font-bold text-primary">{caseData.priority_score}</span>
        </div>
      )}

      <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
        Observations (tap to correct)
      </p>
      <div className="flex flex-col gap-2">
        {ANALYSIS_FLAGS.map((f) => {
          const value = Boolean(analysis[f.key]);
          return (
            <button
              key={f.key as string}
              type="button"
              disabled={overrideFlag.isPending}
              onClick={() => overrideFlag.mutate({ [f.key]: !value })}
              className="flex items-center justify-between rounded-md border border-outline-variant px-3 py-2 text-left transition-colors hover:bg-surface-container-low"
            >
              <span className="text-label-md text-primary">{f.label}</span>
              <Icon
                name={value ? "check_circle" : "cancel"}
                className={value ? "text-[20px] text-success" : "text-[20px] text-outline"}
                filled={value}
              />
            </button>
          );
        })}
        {(analysis.age_range || analysis.gender) && (
          <p className="mt-1 text-label-sm text-on-surface-variant">
            {analysis.age_range && `Age: ${analysis.age_range}`}
            {analysis.age_range && analysis.gender && " · "}
            {analysis.gender && `Gender: ${analysis.gender}`}
          </p>
        )}
      </div>
      <p className="mt-3 text-label-sm text-on-surface-variant">
        AI suggestions assist your judgment. They never decide.
      </p>
    </Card>
  );
}
