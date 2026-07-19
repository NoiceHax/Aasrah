"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/notifications/toast";
import { ngoApi } from "@/lib/api/ngo";
import { normalizeError } from "@/lib/api/client";

/** Suggested duplicate reports with a non-destructive merge action. */
export function DuplicatesPanel({ reportId }: { reportId: string }) {
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ngo", "duplicates", reportId],
    queryFn: () => ngoApi.duplicates(reportId),
  });

  const merge = useMutation({
    mutationFn: (dupId: string) => ngoApi.mergeDuplicate(reportId, dupId),
    onSuccess: (r) => {
      toast.success("Merged", r.message);
      qc.invalidateQueries({ queryKey: ["ngo", "duplicates", reportId] });
    },
    onError: (e) => toast.error("Couldn't merge", normalizeError(e).message),
  });

  if (isLoading) return null;
  if (!data || data.length === 0) {
    return (
      <Card className="p-stack-md">
        <h3 className="text-headline-sm text-primary">Possible Duplicates</h3>
        <p className="mt-2 text-body-sm text-on-surface-variant">No likely duplicates detected.</p>
      </Card>
    );
  }

  return (
    <Card className="p-stack-md">
      <h3 className="mb-3 flex items-center gap-2 text-headline-sm text-primary">
        <Icon name="content_copy" className="text-[20px] text-warning" />
        Possible Duplicates
      </h3>
      <div className="flex flex-col gap-2">
        {data.map((d) => (
          <div key={d.report_id} className="rounded-lg border border-outline-variant p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-primary">#{d.tracking_id}</span>
              <Badge variant={d.confidence > 0.7 ? "danger" : "warning"}>
                {Math.round(d.confidence * 100)}% match
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-body-sm text-on-surface-variant">{d.summary}</p>
            <div className="mt-1 flex items-center gap-3 text-label-sm text-on-surface-variant">
              <span>{d.distance_km * 1000}m away</span>
              <span>{d.time_gap_hours}h apart</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              leadingIcon="merge"
              disabled={merge.isPending}
              onClick={() => merge.mutate(d.report_id)}
            >
              Mark as duplicate of this case
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
