"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/notifications/toast";
import { ngoApi } from "@/lib/api/ngo";
import { normalizeError } from "@/lib/api/client";

export function CaseNotes({ reportId }: { reportId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const { data: notes } = useQuery({
    queryKey: ["ngo", "notes", reportId],
    queryFn: () => ngoApi.notes(reportId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ngo", "notes", reportId] });

  const addMutation = useMutation({
    mutationFn: () => ngoApi.addNote(reportId, draft),
    onSuccess: () => {
      setDraft("");
      invalidate();
      toast.success("Note added");
    },
    onError: (e) => toast.error("Couldn't add note", normalizeError(e).message),
  });

  const editMutation = useMutation({
    mutationFn: (noteId: string) => ngoApi.editNote(reportId, noteId, editBody),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
    onError: (e) => toast.error("Couldn't edit note", normalizeError(e).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => ngoApi.deleteNote(reportId, noteId),
    onSuccess: invalidate,
    onError: (e) => toast.error("Couldn't delete note", normalizeError(e).message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Textarea
          placeholder="Add an internal note (visible only to your team)…"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          size="sm"
          className="self-end"
          leadingIcon="add"
          disabled={!draft.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          Add Note
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {notes?.length === 0 && (
          <p className="text-body-sm text-on-surface-variant">No internal notes yet.</p>
        )}
        {notes?.map((note) => (
          <div key={note.id} className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-label-sm font-semibold text-primary">
                {note.author_name ?? "Unknown"}
                {note.edited && <span className="ml-1 font-normal text-on-surface-variant">(edited)</span>}
              </span>
              <span className="text-label-sm text-on-surface-variant">
                {new Date(note.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>
            {editingId === note.id ? (
              <div className="flex flex-col gap-2">
                <Textarea rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => editMutation.mutate(note.id)}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-body-sm text-on-surface">{note.body}</p>
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(note.id);
                      setEditBody(note.body);
                    }}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
                    title="Edit"
                  >
                    <Icon name="edit" className="text-[16px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(note.id)}
                    className="rounded p-1 text-error hover:bg-error-container"
                    title="Delete"
                  >
                    <Icon name="delete" className="text-[16px]" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
