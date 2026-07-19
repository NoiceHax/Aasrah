import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Aasrah uses cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="June 2026"
      intro="This placeholder policy explains how Aasrah uses cookies and similar technologies. Final legal copy is added before launch."
      sections={[
        {
          heading: "Essential cookies",
          body: "We use a small number of essential cookies required to keep you signed in and to operate core platform features securely.",
        },
        {
          heading: "Analytics",
          body: "With your consent, we use privacy-respecting analytics to understand how the platform is used so we can improve response times and usability.",
        },
        {
          heading: "Managing cookies",
          body: "You can control non-essential cookies through your browser settings or our consent banner. Disabling essential cookies may affect core functionality.",
        },
      ]}
    />
  );
}
