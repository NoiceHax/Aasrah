import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Aasrah collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="June 2026"
      intro="This placeholder policy describes, at a high level, how Aasrah handles personal information. Final legal copy is added before launch."
      sections={[
        {
          heading: "Information we collect",
          body: "We collect the information you provide when filing a report, applying to volunteer, or contacting us, along with limited technical data needed to operate the platform.",
        },
        {
          heading: "How we use information",
          body: "Information is used solely to coordinate humanitarian response, verify reports and partners, and improve the service. Report details are shared only with the verified NGO that claims a case.",
        },
        {
          heading: "Anonymous reports",
          body: "Reports can be submitted anonymously. Where contact details are provided, they help responders verify and follow up, and are never sold or used for marketing.",
        },
        {
          heading: "Your rights",
          body: "You may request access to, correction of, or deletion of your personal data at any time by contacting our support team.",
        },
      ]}
    />
  );
}
