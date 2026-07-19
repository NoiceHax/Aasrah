"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { FieldShell, fieldControl, fieldBorder } from "./field";
import { Icon } from "./icon";

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> & {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, required, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  // Only seed the placeholder as the uncontrolled default. When the consumer
  // controls the select via `value`, forcing `defaultValue` too would make it
  // both controlled and uncontrolled (React warning). A controlled `value=""`
  // already selects the placeholder option on its own.
  const isControlled = props.value !== undefined;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(fieldControl, fieldBorder(error), "appearance-none pr-10")}
          defaultValue={!isControlled && placeholder ? "" : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Icon
          name="expand_more"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
        />
      </div>
    </FieldShell>
  );
});
