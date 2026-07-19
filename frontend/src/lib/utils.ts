import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts predictably. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number with thousands separators (e.g. 12450 -> "12,450"). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
