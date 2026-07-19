"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { adminApi } from "@/lib/api/admin";

export default function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", { action, page }],
    queryFn: () => adminApi.auditLogs({ action: action.trim() || undefined, page, page_size: 50 }),
  });

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["timestamp", "action", "actor_id", "entity_type", "entity_id", "ip"],
      ...data.items.map((l) => [
        l.created_at, l.action, l.actor_id ?? "", l.entity_type ?? "", l.entity_id ?? "", l.ip_address ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-logs.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <ShellPageHeader
        title="Audit Logs"
        description="Searchable record of platform activity."
        action={<Button variant="outline" size="sm" leadingIcon="download" onClick={exportCsv} disabled={!data?.items.length}>Export CSV</Button>}
      />

      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        <Card className="p-stack-md">
          <Input
            label="Filter by action"
            leadingIcon="search"
            placeholder="e.g. report.claim, ngo.verify…"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {["Time", "Action", "Entity", "Actor", "IP"].map((h) => (
                    <th key={h} className="px-4 py-3 text-label-sm uppercase tracking-wider text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-4 py-2"><Skeleton className="h-5 w-full" /></td></tr>
                  ))
                ) : data && data.items.length > 0 ? (
                  data.items.map((l) => (
                    <tr key={l.id} className="hover:bg-surface-container-low">
                      <td className="px-4 py-2 text-label-sm text-on-surface-variant">{new Date(l.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2"><code className="rounded bg-surface-container-high px-1.5 py-0.5 text-label-sm text-primary">{l.action}</code></td>
                      <td className="px-4 py-2 text-label-sm text-on-surface-variant">{l.entity_type ?? "-"}</td>
                      <td className="px-4 py-2 text-label-sm text-on-surface-variant">{l.actor_id ? l.actor_id.slice(0, 8) : "system"}</td>
                      <td className="px-4 py-2 text-label-sm text-on-surface-variant">{l.ip_address ?? "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-4 py-12"><EmptyState icon="history" title="No audit entries" /></td></tr>
                )}
              </tbody>
            </table>
          </div>
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
              <span className="text-label-sm text-on-surface-variant">Page {data.page} of {data.pages} · {data.total} entries</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
