"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StatusBadge, PriorityBadge } from "@/components/portal/status-badge";
import { useToast } from "@/components/notifications/toast";
import { ngoApi } from "@/lib/api/ngo";
import { normalizeError } from "@/lib/api/client";
import type { SemanticSearchResult, ReportStatus, ReportPriority } from "@/lib/api/types";

const EXAMPLES = [
  "children needing shelter today",
  "unclaimed medical reports",
  "cases waiting more than 3 hours",
  "reports near hospital",
];

/** Natural-language report search powered by the AI query parser. */
export function SemanticSearchBar() {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SemanticSearchResult | null>(null);

  const search = useMutation({
    mutationFn: (query: string) => ngoApi.semanticSearch(query),
    onSuccess: setResult,
    onError: (e) => toast.error("Search failed", normalizeError(e).message),
  });

  const run = (query: string) => {
    setQ(query);
    if (query.trim().length >= 2) search.mutate(query.trim());
  };

  return (
    <Card className="p-stack-md">
      <div className="mb-2 flex items-center gap-2">
        <Icon name="auto_awesome" className="text-[20px] text-secondary" filled />
        <h3 className="text-headline-sm text-primary">Smart Search</h3>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask in plain language…"
          className="flex-1 rounded-md border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-body-md outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
        />
        <Button type="submit" leadingIcon="search" disabled={search.isPending}>
          {search.isPending ? "…" : "Search"}
        </Button>
      </form>

      {!result && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => run(ex)}
              className="rounded-full border border-outline-variant px-3 py-1 text-label-sm text-on-surface-variant transition-colors hover:border-secondary/50 hover:text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-label-sm text-on-surface-variant">
              {result.count} result{result.count === 1 ? "" : "s"} for &ldquo;{result.query}&rdquo;
            </span>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setQ("");
              }}
              className="text-label-sm text-secondary hover:underline"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-col divide-y divide-outline-variant">
            {result.results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(`/portal/cases/${r.id}`)}
                className="flex items-center justify-between gap-3 py-2 text-left hover:bg-surface-container-low"
              >
                <div className="min-w-0">
                  <span className="font-medium text-primary">#{r.tracking_id}</span>
                  <p className="truncate text-body-sm text-on-surface-variant">
                    {r.summary ?? r.address ?? r.situation}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <PriorityBadge priority={r.priority as ReportPriority} />
                  <StatusBadge status={r.status as ReportStatus} />
                </div>
              </button>
            ))}
            {result.count === 0 && (
              <p className="py-3 text-body-sm text-on-surface-variant">No matching reports.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
