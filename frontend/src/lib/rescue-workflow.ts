import type { ReportStatus } from "@/lib/api/types";

/** Mirrors the backend rescue-workflow state machine for UI affordances. */
const TRANSITIONS: Partial<Record<ReportStatus, ReportStatus[]>> = {
  pending: ["claimed", "rejected"],
  verified: ["claimed", "rejected"],
  claimed: ["volunteer_assigned", "rejected"],
  volunteer_assigned: ["volunteer_accepted", "claimed"],
  volunteer_accepted: ["on_route"],
  on_route: ["reached_location"],
  reached_location: ["rescue_completed"],
  rescue_completed: ["shelter_assigned", "closed"],
  shelter_assigned: ["closed"],
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  claimed: "Claimed",
  volunteer_assigned: "Assign Volunteer",
  volunteer_accepted: "Volunteer Accepted",
  on_route: "Mark On Route",
  reached_location: "Mark Reached Location",
  rescue_completed: "Mark Rescue Completed",
  shelter_assigned: "Assign Shelter",
  closed: "Close Case",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Reject",
};

/** Next statuses an NGO can move a case to. Excludes transitions driven by the
 * volunteer (e.g. volunteer_accepted) which happen via the volunteer's action. */
export function nextStatuses(current: ReportStatus): ReportStatus[] {
  return (TRANSITIONS[current] ?? []).filter((s) => s !== "volunteer_accepted");
}
