"use client";

import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { NotificationCenter } from "@/components/portal/notification-center";

export default function VolunteerNotificationsPage() {
  return (
    <>
      <ShellPageHeader title="Notifications" />
      <NotificationCenter />
    </>
  );
}
