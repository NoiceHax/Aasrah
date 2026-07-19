import { Badge } from "@/components/ui/badge";
import type { ReportStatus, ReportPriority } from "@/lib/api/types";

type BadgeVariant = "neutral" | "secondary" | "success" | "warning" | "danger" | "info";

const STATUS_MAP: Record<ReportStatus, { variant: BadgeVariant; label: string }> = {
  pending: { variant: "warning", label: "Pending" },
  verified: { variant: "info", label: "Verified" },
  claimed: { variant: "info", label: "Claimed" },
  volunteer_assigned: { variant: "secondary", label: "Volunteer Assigned" },
  volunteer_accepted: { variant: "secondary", label: "Volunteer Accepted" },
  on_route: { variant: "secondary", label: "On Route" },
  reached_location: { variant: "secondary", label: "Reached Location" },
  rescue_completed: { variant: "success", label: "Rescue Completed" },
  shelter_assigned: { variant: "success", label: "Shelter Assigned" },
  closed: { variant: "success", label: "Closed" },
  in_progress: { variant: "info", label: "In Progress" },
  resolved: { variant: "success", label: "Resolved" },
  rejected: { variant: "danger", label: "Rejected" },
};

const PRIORITY_MAP: Record<ReportPriority, { variant: BadgeVariant; label: string }> = {
  critical: { variant: "danger", label: "Critical" },
  high: { variant: "warning", label: "High" },
  medium: { variant: "info", label: "Medium" },
  stable: { variant: "success", label: "Stable" },
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const cfg = STATUS_MAP[status] ?? { variant: "neutral" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: ReportPriority }) {
  const cfg = PRIORITY_MAP[priority] ?? { variant: "neutral" as const, label: priority };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
