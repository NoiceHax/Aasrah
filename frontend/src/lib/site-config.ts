export const siteConfig = {
  name: "Aasrah",
  tagline: "Empowering Humanitarian Response",
  description:
    "Aasrah bridges the gap between people in need and organizations ready to help. We streamline emergency reporting and volunteer coordination for a more resilient community.",
  url: "https://aasrah.vercel.app",
  developerEmail: "chandanp24107@gmail.com",
} as const;

export type SiteConfig = typeof siteConfig;

/**
 * Indian emergency numbers, surfaced wherever someone might be looking at a
 * situation that needs a responder faster than this platform can coordinate
 * one. Aasrah is not an emergency dispatch service and must never read as one.
 *
 * Single source of truth: the report form, the FAQ and the case-escalation
 * prompts all render from here, so these never drift apart.
 */
export const emergencyContacts = [
  { label: "Emergency (all services)", number: "112" },
  { label: "Ambulance", number: "108" },
  { label: "Child helpline", number: "1098" },
  { label: "Women's helpline", number: "181" },
] as const;

/**
 * The disclaimer itself. Kept verbatim alongside the numbers so the two are
 * never shown apart.
 */
export const emergencyDisclaimer =
  "Aasrah is not a substitute for emergency services and does not provide emergency dispatch. If someone's life is in immediate danger, call one of these first.";

export type EmergencyContact = (typeof emergencyContacts)[number];
