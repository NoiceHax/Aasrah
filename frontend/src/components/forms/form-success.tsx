import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

type FormSuccessProps = {
  title: string;
  description: string;
  referenceId?: string;
  onReset?: () => void;
  resetLabel?: string;
};

export function FormSuccess({
  title,
  description,
  referenceId,
  onReset,
  resetLabel = "Submit another",
}: FormSuccessProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-on-success-soft">
        <Icon name="check_circle" className="text-[40px]" filled />
      </div>
      <h3 className="text-headline-sm text-primary">{title}</h3>
      <p className="max-w-md text-body-md text-on-surface-variant">{description}</p>
      {referenceId && (
        <div className="rounded-lg border border-outline-variant bg-surface-container-low px-5 py-3">
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            Reference ID
          </span>
          <p className="text-headline-sm font-bold text-primary">{referenceId}</p>
        </div>
      )}
      {onReset && (
        <Button variant="outline" onClick={onReset} leadingIcon="refresh" className="mt-2">
          {resetLabel}
        </Button>
      )}
    </div>
  );
}
