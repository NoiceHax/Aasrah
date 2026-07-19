"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/notifications/toast";
import { adminApi } from "@/lib/api/admin";
import { normalizeError } from "@/lib/api/client";

const TRIGGERS = [
  { value: "escalate_unclaimed", label: "Escalate unclaimed reports" },
  { value: "close_inactive", label: "Close inactive cases" },
  { value: "weekly_summary", label: "Send weekly summaries" },
  { value: "expand_radius", label: "Expand notification radius" },
  { value: "volunteer_reminder", label: "Volunteer reminders" },
  { value: "archive_completed", label: "Archive completed" },
];

export default function AutomationPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("escalate_unclaimed");
  const [threshold, setThreshold] = useState(60);

  const { data: rules } = useQuery({
    queryKey: ["admin", "automation-rules"],
    queryFn: adminApi.automationRules,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "automation-rules"] });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createAutomationRule({ name, trigger, enabled: true, threshold_minutes: threshold }),
    onSuccess: () => {
      toast.success("Rule created");
      setName("");
      invalidate();
    },
    onError: (e) => toast.error("Couldn't create", normalizeError(e).message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      adminApi.toggleAutomationRule(id, enabled),
    onSuccess: invalidate,
    onError: (e) => toast.error("Couldn't update", normalizeError(e).message),
  });

  const runNow = useMutation({
    mutationFn: () => adminApi.runAutomation(),
    onSuccess: (r) => toast.success("Triggered", r.message),
    onError: (e) => toast.error("Couldn't run", normalizeError(e).message),
  });

  return (
    <>
      <ShellPageHeader
        title="Automation"
        description="Rules that run on a schedule to reduce manual work."
        action={
          <Button variant="outline" leadingIcon="play_arrow" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
            Run now
          </Button>
        }
      />

      <div className="grid gap-gutter p-margin-mobile md:p-margin-desktop lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-stack-md">
          <h2 className="text-headline-sm text-primary">New Rule</h2>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Trigger" options={TRIGGERS} value={trigger} onChange={(e) => setTrigger(e.target.value)} />
          <Input
            label="Threshold (minutes)"
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
          <Button leadingIcon="add" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()} className="self-start">
            Create Rule
          </Button>
        </Card>

        <div className="flex flex-col gap-3">
          {rules && rules.length > 0 ? (
            rules.map((r) => (
              <Card key={r.id} className="flex items-center justify-between p-stack-md">
                <div>
                  <p className="text-label-md font-semibold text-primary">{r.name}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {r.trigger.replace(/_/g, " ")} · every {r.threshold_minutes}m · ran {r.run_count}×
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.enabled ? "success" : "neutral"}>{r.enabled ? "On" : "Off"}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggle.mutate({ id: r.id, enabled: !r.enabled })}
                  >
                    {r.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState icon="bolt" title="No automation rules" description="Create a rule to automate operations." />
          )}
        </div>
      </div>
    </>
  );
}
