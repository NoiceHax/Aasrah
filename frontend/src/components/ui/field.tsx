import { cn } from "@/lib/utils";

/** Shared label + error + hint scaffolding for form controls. */
export function FieldShell({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="px-0.5 text-label-md text-on-surface-variant">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="px-0.5 text-label-sm font-medium text-error">{error}</p>
      ) : hint ? (
        <p className="px-0.5 text-label-sm text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

export const fieldControl =
  "w-full rounded-md border bg-surface-container-low px-3.5 py-2.5 text-body-md text-on-surface placeholder:text-outline transition-colors outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20";

export const fieldBorder = (error?: string) =>
  error ? "border-error focus:border-error focus:ring-error/20" : "border-outline-variant";
