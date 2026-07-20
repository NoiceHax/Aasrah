"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * Renders a stored file that sits behind authorization.
 *
 * Report photographs and case attachments are personal data about vulnerable
 * people, so they are no longer served from a public static mount — they come
 * from `GET /api/v1/files/{key}`, which requires a bearer token and re-checks
 * case ownership. A bare `<img src>` cannot send that token, so we fetch the
 * bytes through the API client and render them as a short-lived object URL.
 *
 * `src` is the path returned by the API (e.g. `/api/v1/files/AR-9402/x.jpg`).
 */
export function AuthedImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let created: string | undefined;

    // `src` is an absolute path under the API origin; apiClient is already
    // based at /api/v1, so strip that prefix to avoid doubling it.
    const path = src.replace(/^.*\/api\/v1/, "");

    apiClient
      .get(path, { responseType: "blob" })
      .then((res) => {
        if (revoked) return;
        created = URL.createObjectURL(res.data as Blob);
        setObjectUrl(created);
      })
      .catch(() => {
        if (!revoked) setFailed(true);
      });

    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} (unavailable)`}
        className={cn(
          "flex items-center justify-center bg-surface-container text-label-sm text-on-surface-variant",
          className,
        )}
      >
        Unavailable
      </div>
    );
  }

  if (!objectUrl) {
    return <div aria-hidden className={cn("animate-pulse bg-surface-container", className)} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={objectUrl} alt={alt} className={className} />;
}
