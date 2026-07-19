"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PortalPageHeader } from "@/components/portal/portal-shell";
import { StatusBadge, PriorityBadge } from "@/components/portal/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ngoApi } from "@/lib/api/ngo";

export default function CasesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["ngo", "claimed", page],
    queryFn: () => ngoApi.claimed({ page, page_size: 15 }),
  });

  return (
    <>
      <PortalPageHeader title="My Cases" description="Cases your organization has claimed." />

      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {["Case ID", "Priority", "Situation", "Status", "Claimed", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-label-sm uppercase tracking-wider text-on-surface-variant">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : data && data.items.length > 0 ? (
                  data.items.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer transition-colors hover:bg-surface-container-low"
                      onClick={() => router.push(`/portal/cases/${r.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-primary">#{r.tracking_id}</td>
                      <td className="px-4 py-3"><PriorityBadge priority={r.priority} /></td>
                      <td className="px-4 py-3 text-body-sm capitalize">{r.situation}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-body-sm text-on-surface-variant">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" href={`/portal/cases/${r.id}`}>
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-on-surface-variant">
                      No claimed cases yet. Discover reports to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
              <span className="text-label-sm text-on-surface-variant">
                Page {data.page} of {data.pages} · {data.total} cases
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
