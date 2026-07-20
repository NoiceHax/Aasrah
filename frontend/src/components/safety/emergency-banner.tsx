import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { emergencyContacts, emergencyDisclaimer } from "@/lib/site-config";

/**
 * "Call these first" banner.
 *
 * Shown wherever someone may be looking at a life-threatening situation:
 * the public report form, and the escalation prompts inside the NGO and
 * volunteer views. The numbers are tappable `tel:` links — telling a panicking
 * person to "contact your local emergency services" without giving them a
 * number costs time that they do not have.
 */
export function EmergencyBanner({ className }: { className?: string }) {
  return (
    <aside
      aria-label="Emergency contact information"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3",
        className,
      )}
    >
      <Icon name="emergency" className="mt-0.5 text-[20px] text-on-warning-soft" />
      <div className="flex flex-col gap-2">
        <p className="text-body-sm text-on-warning-soft">{emergencyDisclaimer}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {emergencyContacts.map((c) => (
            <li key={c.number}>
              <a
                href={`tel:${c.number}`}
                className="text-label-md font-semibold text-on-warning-soft underline underline-offset-2"
              >
                {c.number}
                <span className="ml-1 font-normal opacity-80">{c.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
