"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShellPageHeader } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/notifications/toast";
import { adminApi } from "@/lib/api/admin";
import { normalizeError } from "@/lib/api/client";
import type { AnnouncementAudience } from "@/lib/api/types";

const audienceOptions = [
  { value: "everyone", label: "Everyone" },
  { value: "ngo", label: "NGOs" },
  { value: "volunteer", label: "Volunteers" },
];

export default function AnnouncementsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("everyone");
  const [pinned, setPinned] = useState(false);

  const { data } = useQuery({ queryKey: ["admin", "announcements"], queryFn: adminApi.announcements });

  const create = useMutation({
    mutationFn: () => adminApi.createAnnouncement({ title, body, audience, pinned }),
    onSuccess: () => {
      toast.success("Announcement broadcast");
      setTitle("");
      setBody("");
      setPinned(false);
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
    onError: (e) => toast.error("Couldn't create", normalizeError(e).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "announcements"] }),
    onError: (e) => toast.error("Couldn't delete", normalizeError(e).message),
  });

  return (
    <>
      <ShellPageHeader title="Announcements" description="Broadcast messages across the platform." />

      <div className="grid gap-gutter p-margin-mobile md:p-margin-desktop lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-stack-md">
          <h2 className="text-headline-sm text-primary">New Announcement</h2>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label="Message" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          <Select label="Audience" options={audienceOptions} value={audience} onChange={(e) => setAudience(e.target.value as AnnouncementAudience)} />
          <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="rounded border-outline-variant text-secondary focus:ring-secondary" />
            Pin this announcement
          </label>
          <Button
            leadingIcon="campaign"
            disabled={!title.trim() || !body.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="self-start"
          >
            Broadcast
          </Button>
        </Card>

        <div className="flex flex-col gap-3">
          {data && data.length > 0 ? (
            data.map((a) => (
              <Card key={a.id} className="flex items-start justify-between gap-3 p-stack-md">
                <div>
                  <div className="flex items-center gap-2">
                    {a.pinned && <Icon name="push_pin" className="text-[16px] text-secondary" filled />}
                    <p className="text-label-md font-semibold text-primary">{a.title}</p>
                    <Badge variant="info">{a.audience}</Badge>
                  </div>
                  <p className="mt-1 text-body-sm text-on-surface-variant">{a.body}</p>
                  <p className="mt-1 text-label-sm text-on-surface-variant">{new Date(a.created_at).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(a.id)}
                  className="rounded p-1.5 text-error hover:bg-error-container"
                  title="Delete"
                  aria-label="Delete announcement"
                >
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </Card>
            ))
          ) : (
            <EmptyState icon="campaign" title="No announcements" description="Broadcasts you create appear here." />
          )}
        </div>
      </div>
    </>
  );
}
