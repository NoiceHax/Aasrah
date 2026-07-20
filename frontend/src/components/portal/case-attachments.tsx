"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/notifications/toast";
import { ngoApi } from "@/lib/api/ngo";
import { AuthedImage } from "@/components/ui/authed-image";
import { downloadAuthedFile } from "@/lib/api/endpoints";
import { normalizeError } from "@/lib/api/client";

const categories = [
  { value: "rescue_photo", label: "Rescue photo" },
  { value: "medical_doc", label: "Medical document" },
  { value: "shelter_doc", label: "Shelter document" },
  { value: "proof_of_completion", label: "Proof of completion" },
  { value: "other", label: "Other" },
];

function isImage(contentType: string | null): boolean {
  return !!contentType && contentType.startsWith("image/");
}

export function CaseAttachments({ reportId }: { reportId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("rescue_photo");

  const { data: attachments } = useQuery({
    queryKey: ["ngo", "attachments", reportId],
    queryFn: () => ngoApi.attachments(reportId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ngo", "attachments", reportId] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => ngoApi.uploadAttachment(reportId, file, category),
    onSuccess: () => {
      toast.success("Attachment uploaded");
      invalidate();
    },
    onError: (e) => toast.error("Upload failed", normalizeError(e).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ngoApi.deleteAttachment(reportId, id),
    onSuccess: invalidate,
    onError: (e) => toast.error("Couldn't delete", normalizeError(e).message),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Select
          label="Category"
          options={categories}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="min-w-[180px]"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadMutation.mutate(f);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          leadingIcon="upload"
          disabled={uploadMutation.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {uploadMutation.isPending ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {attachments?.length === 0 && (
        <p className="text-body-sm text-on-surface-variant">No attachments yet.</p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {attachments?.map((att) => (
          <div key={att.id} className="group relative overflow-hidden rounded-lg border border-outline-variant">
            {isImage(att.content_type) ? (
              <AuthedImage
                src={att.url}
                alt={att.original_filename ?? "attachment"}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-surface-container-low p-2 text-center">
                <Icon name="description" className="text-[32px] text-secondary" />
                <span className="truncate text-label-sm text-on-surface-variant">
                  {att.original_filename}
                </span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-primary/80 px-2 py-1">
              <span className="truncate text-label-sm text-on-primary">{att.category.replace(/_/g, " ")}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => downloadAuthedFile(att.url, att.original_filename ?? undefined)}
                  className="text-on-primary hover:text-secondary-fixed-dim"
                  title="Open"
                >
                  <Icon name="download" className="text-[16px]" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(att.id)}
                  className="text-on-primary hover:text-error-container"
                  title="Delete"
                >
                  <Icon name="delete" className="text-[16px]" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
