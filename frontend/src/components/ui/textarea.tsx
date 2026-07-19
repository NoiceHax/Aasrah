"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { FieldShell, fieldControl, fieldBorder } from "./field";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, required, className, id, rows = 4, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(fieldControl, fieldBorder(error), "resize-y")}
        {...props}
      />
    </FieldShell>
  );
});
