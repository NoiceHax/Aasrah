"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PortalPageHeader } from "@/components/portal/portal-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/notifications/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { ngoApi } from "@/lib/api/ngo";
import { normalizeError } from "@/lib/api/client";

export default function SettingsPage() {
  const toast = useToast();
  const { logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();

  const mutation = useMutation({
    mutationFn: () => ngoApi.changePassword(current, next),
    onSuccess: async () => {
      toast.success("Password changed", "Please sign in again.");
      await logout();
    },
    onError: (e) => toast.error("Couldn't change password", normalizeError(e).message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError(undefined);
    mutation.mutate();
  };

  return (
    <>
      <PortalPageHeader title="Settings" description="Manage your account security." />

      <div className="max-w-xl space-y-stack-lg p-margin-mobile md:p-margin-desktop">
        <Card className="p-stack-md">
          <h2 className="mb-4 text-headline-sm text-primary">Change Password</h2>
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <Input
              label="Current password"
              type="password"
              leadingIcon="lock"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
            <Input
              label="New password"
              type="password"
              leadingIcon="lock_reset"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
            <Input
              label="Confirm new password"
              type="password"
              leadingIcon="lock_reset"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={error}
              autoComplete="new-password"
            />
            <Button type="submit" className="self-start" disabled={mutation.isPending}>
              {mutation.isPending ? "Updating…" : "Update Password"}
            </Button>
          </form>
        </Card>

        <Card className="p-stack-md">
          <h2 className="mb-2 text-headline-sm text-primary">Account Preferences</h2>
          <p className="text-body-sm text-on-surface-variant">
            Notification preferences and team management will be available in a future update.
          </p>
        </Card>
      </div>
    </>
  );
}
