"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { routes } from "@/lib/routes";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In a later phase this routes to an error-reporting service.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger-soft text-on-danger-soft">
        <Icon name="error" className="text-[32px]" />
      </div>
      <p className="text-headline-lg font-bold text-error">500</p>
      <h1 className="mt-2 text-headline-md text-primary">Something went wrong</h1>
      <p className="mt-3 max-w-md text-body-md text-on-surface-variant">
        An unexpected error occurred on our end. You can try again, or head back to safety.
      </p>
      {error.digest && (
        <p className="mt-2 text-label-sm text-on-surface-variant">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} leadingIcon="refresh">
          Try again
        </Button>
        <Button href={routes.home} variant="outline" leadingIcon="home">
          Back to home
        </Button>
      </div>
    </div>
  );
}
