"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 10;

export interface PreviewFile {
  file: File;
  url: string;
}

interface ImageUploadProps {
  files: PreviewFile[];
  onChange: (files: PreviewFile[]) => void;
  max?: number;
  onError?: (message: string) => void;
}

export function ImageUpload({ files, onChange, max = 6, onError }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => files.forEach((f) => URL.revokeObjectURL(f.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      const valid: PreviewFile[] = [];
      for (const file of list) {
        if (!ACCEPTED.includes(file.type)) {
          onError?.(`"${file.name}" isn't a supported image (JPEG, PNG, or WEBP).`);
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          onError?.(`"${file.name}" is larger than ${MAX_MB}MB.`);
          continue;
        }
        valid.push({ file, url: URL.createObjectURL(file) });
      }
      const next = [...files, ...valid].slice(0, max);
      if (files.length + valid.length > max) {
        onError?.(`You can attach up to ${max} images.`);
      }
      onChange(next);
    },
    [files, max, onChange, onError],
  );

  const removeAt = (index: number) => {
    const target = files[index];
    if (target) URL.revokeObjectURL(target.url);
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging
            ? "border-secondary bg-secondary-fixed/40"
            : "border-outline-variant bg-surface-container-low hover:border-secondary/50",
        )}
      >
        <Icon name="photo_camera" className="text-[32px] text-secondary" />
        <span className="text-label-md font-semibold text-primary">Take a photo</span>
        <span className="text-label-sm text-on-surface-variant">
          Or drag images here · JPEG, PNG, or WEBP · up to {MAX_MB}MB each · max {max} images
        </span>
      </button>

      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        className="self-center text-label-sm text-on-surface-variant underline underline-offset-2 hover:text-primary"
      >
        Choose an existing photo instead
      </button>

      {/*
        Two inputs rather than one: `capture` asks the device to open the
        camera directly, which is the right default when someone is standing
        in front of the situation they are reporting. It is only a hint —
        authorisation is enforced server-side by the upload token — and it
        must not be the only option, since plenty of genuine reports are filed
        from a photo taken minutes earlier.
      */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((f, i) => (
            <div
              key={f.url}
              className="group relative aspect-square overflow-hidden rounded-md border border-outline-variant"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.file.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                // Visible by default, dimmed on pointer devices until hover.
                // A hover-only affordance is unreachable on a phone — which is
                // where most reports are filed — and invisible to keyboard focus.
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/80 text-on-primary transition-opacity focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                aria-label={`Remove ${f.file.name}`}
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
