"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalPageHeader } from "@/components/portal/portal-shell";
import { SemanticSearchBar } from "@/components/portal/semantic-search-bar";
import { StatusBadge, PriorityBadge } from "@/components/portal/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/notifications/toast";
import { ngoApi, type NearbyFilters } from "@/lib/api/ngo";
import { normalizeError } from "@/lib/api/client";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "claimed", label: "Claimed" },
];

const distanceOptions = [
  { value: "", label: "Any distance" },
  { value: "5", label: "< 5 km" },
  { value: "20", label: "< 20 km" },
  { value: "50", label: "< 50 km" },
];

const timeOptions = [
  { value: "", label: "Any time" },
  { value: "1", label: "Last hour" },
  { value: "24", label: "Last 24h" },
  { value: "168", label: "Last week" },
];

export default function ReportsDiscoveryPage() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [distance, setDistance] = useState("");
  const [time, setTime] = useState("");
  const [childrenOnly, setChildrenOnly] = useState(false);
  const [medicalOnly, setMedicalOnly] = useState(false);
  const [page, setPage] = useState(1);

  const filters: NearbyFilters = {
    search: search.trim() || undefined,
    status: (status || undefined) as NearbyFilters["status"],
    max_distance_km: distance ? Number(distance) : undefined,
    since_hours: time ? Number(time) : undefined,
    children_only: childrenOnly || undefined,
    medical_only: medicalOnly || undefined,
    page,
    page_size: 15,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["ngo", "nearby", filters],
    queryFn: () => ngoApi.nearby(filters),
  });

  const claimMutation = useMutation({
    mutationFn: (reportId: string) => ngoApi.claim(reportId),
    onSuccess: (caseDetail) => {
      toast.success("Report claimed", `Case ${caseDetail.tracking_id} is now yours.`);
      qc.invalidateQueries({ queryKey: ["ngo", "nearby"] });
      qc.invalidateQueries({ queryKey: ["ngo", "dashboard"] });
      router.push(`/portal/cases/${caseDetail.id}`);
    },
    onError: (e) => toast.error("Couldn't claim report", normalizeError(e).message),
  });

  return (
    <>
      <PortalPageHeader
        title="Nearby Reports"
        description="Discover and claim reports within your service area."
      />

      <div className="space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        {/* Natural-language search */}
        <SemanticSearchBar />

        {/* Filters */}
        <Card className="p-stack-md">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Search"
              leadingIcon="search"
              placeholder="ID, address, keyword…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Select
              label="Status"
              options={statusOptions}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            />
            <Select
              label="Distance"
              options={distanceOptions}
              value={distance}
              onChange={(e) => {
                setDistance(e.target.value);
                setPage(1);
              }}
            />
            <Select
              label="Time"
              options={timeOptions}
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
              <input
                type="checkbox"
                checked={childrenOnly}
                onChange={(e) => {
                  setChildrenOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-outline-variant text-secondary focus:ring-secondary"
              />
              Children present
            </label>
            <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
              <input
                type="checkbox"
                checked={medicalOnly}
                onChange={(e) => {
                  setMedicalOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-outline-variant text-secondary focus:ring-secondary"
              />
              Medical urgency
            </label>
          </div>
        </Card>

        {/* Results */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {["Report ID", "Priority", "Situation", "Distance", "Status", "Flags", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-label-sm uppercase tracking-wider text-on-surface-variant">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-4 py-3">
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
                      <td className="px-4 py-3 text-body-sm">{r.distance_km != null ? `${r.distance_km} km` : "-"}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {r.children_present && (
                            <Icon name="child_care" className="text-[18px] text-warning" title="Children present" />
                          )}
                          {r.image_count > 0 && (
                            <span className="flex items-center gap-0.5 text-label-sm text-on-surface-variant">
                              <Icon name="image" className="text-[16px]" />
                              {r.image_count}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {r.status === "pending" && !r.claimed_by_ngo_id ? (
                          <Button
                            size="sm"
                            variant="success"
                            leadingIcon="task_alt"
                            disabled={claimMutation.isPending}
                            onClick={() => claimMutation.mutate(r.id)}
                          >
                            Claim
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" href={`/portal/cases/${r.id}`}>
                            View
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant">
                      No reports match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
              <span className="text-label-sm text-on-surface-variant">
                Page {data.page} of {data.pages} · {data.total} reports
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
