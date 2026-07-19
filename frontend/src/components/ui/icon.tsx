import { cn } from "@/lib/utils";

type IconProps = {
  name: string;
  className?: string;
  filled?: boolean;
  title?: string;
  "aria-hidden"?: boolean;
};

/**
 * Material Symbols (Outlined) icon. The font is loaded globally in the root
 * layout. Decorative by default. Pass a label via aria where it conveys meaning.
 */
export function Icon({ name, className, filled, title, ...props }: IconProps) {
  return (
    <span
      aria-hidden={props["aria-hidden"] ?? true}
      title={title}
      style={filled ? { fontVariationSettings: '"FILL" 1' } : undefined}
      className={cn("material-symbols-outlined select-none", className)}
    >
      {name}
    </span>
  );
}
