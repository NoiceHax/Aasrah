import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of the Aasrah platform.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="June 2026"
      intro="These placeholder terms govern use of the Aasrah platform. Final legal copy is added before launch."
      sections={[
        {
          heading: "Acceptable use",
          body: "Aasrah is provided to coordinate genuine humanitarian response. Submitting knowingly false reports or misusing the platform is prohibited and may result in account suspension.",
        },
        {
          heading: "Accounts",
          body: "You are responsible for maintaining the confidentiality of your account credentials and for activity that occurs under your account.",
        },
        {
          heading: "NGO verification",
          body: "Organizations must complete verification before claiming cases. Aasrah may revoke verified status where requirements are no longer met.",
        },
        {
          heading: "Limitation of liability",
          body: "Aasrah coordinates response but does not itself provide emergency services. In life-threatening situations, contact local emergency services first.",
        },
      ]}
    />
  );
}
