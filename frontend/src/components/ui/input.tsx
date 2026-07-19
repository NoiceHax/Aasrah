"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { FieldShell, fieldControl, fieldBorder } from "./field";
import { Icon } from "./icon";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leadingIcon, required, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <FieldShell
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <div className="relative">
        {leadingIcon && (
          <Icon
            name={leadingIcon}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(fieldControl, fieldBorder(error), leadingIcon && "pl-10")}
          {...props}
        />
      </div>
    </FieldShell>
  );
});
