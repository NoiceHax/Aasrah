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
      updated="July 2026"
      intro="These terms govern your use of Aasrah. Please read the first section before anything else: Aasrah is not an emergency service, and filing a report here is not the same as calling for help. By using the platform you agree to these terms."
      sections={[
        {
          heading: "Aasrah is not an emergency service",
          body: [
            "Aasrah is a coordination platform. It is not an ambulance service, not the police, not a fire service, and not an emergency dispatch system of any kind.",
            "Filing a report does not summon anyone. Nothing on this platform is monitored around the clock, and no report is guaranteed to be read within any particular period of time.",
            "If a person's life, health, or safety is at immediate risk, call the emergency services first: 112 for all-in-one emergency response, 108 for an ambulance in most states, 100 for police, 101 for fire, 1098 for Childline, and 181 for the women's helpline. Use Aasrah afterwards, or alongside — never instead.",
            "If you are reporting a missing person, file a police report. Aasrah does not replace a First Information Report and has no authority to conduct a search.",
          ],
        },
        {
          heading: "No guarantee of response, dispatch, or outcome",
          body: [
            "We do not promise that any report will be claimed, that any organisation will attend, or that anyone will be helped. Partner organisations are independent and decide for themselves which cases they take on, subject to their own capacity, mandate, and geography.",
            "A case may go unclaimed indefinitely. A case may be closed without anyone having attended. Case status shown in the app reflects what partners have recorded, not a verified account of what happened on the ground.",
            "Response times, priority scores, and AI-generated summaries are indicative aids for triage. They are not commitments, and an assigned priority is not a promise about how fast anyone will act.",
            "The service is provided on an 'as is' and 'as available' basis, without warranties of any kind. We do not warrant that the platform will be uninterrupted, timely, secure, or error-free.",
          ],
        },
        {
          heading: "Filing a report responsibly",
          body: [
            "Report only what you have genuinely observed, and describe it accurately. Responders act on what you write.",
            "Do not file knowingly false, malicious, or duplicate reports. Doing so diverts scarce humanitarian capacity away from people who need it and may constitute an offence.",
            "Do not use Aasrah to surveil, harass, track, shame, or retaliate against any person, and do not report someone in order to have them removed from a place.",
            "Photograph a person only where it genuinely helps someone find and assist them. Do not upload images that are gratuitous, degrading, sexual, or that show a person in a state of undress or serious medical distress beyond what is needed to convey the situation.",
            "Where you can safely and meaningfully do so, tell the person that you are filing a report and what it involves. This is not always possible, and we do not require it — but it is the right default.",
            "You confirm that you have the right to submit any content you upload, and you grant us the limited right to store it and share it with responders strictly for the purposes described in our Privacy Policy.",
          ],
        },
        {
          heading: "Accounts",
          body: [
            "Public self-registration is available to volunteers. NGO and administrator accounts are provisioned by us following verification.",
            "You must be 18 or older to hold an account.",
            "You are responsible for keeping your credentials confidential and for activity under your account. Tell us promptly if you believe your account has been compromised.",
            "Provide accurate information and keep it current. We may suspend or terminate accounts that breach these terms, that misuse case data, or that are used to file false reports.",
          ],
        },
        {
          heading: "Obligations of partner organisations",
          body: [
            "Organisations must complete verification before claiming cases, and must supply accurate registration, contact, and service-area information. We may revoke verified status at any time where requirements are no longer met or where conduct warrants it.",
            "Case data is provided for one purpose: responding to the case. Organisations must not use it for fundraising, publicity, research, marketing, proselytising, or any purpose unrelated to the response.",
            "Organisations must not republish, sell, or otherwise disclose case content — in particular photographs, precise locations, descriptions of individuals, and reporter contact details — outside their own responding staff, except where legally required or necessary to protect life.",
            "Organisations must handle personal data in compliance with the Digital Personal Data Protection Act, 2023 and all other applicable law, restrict access to staff who need it, and delete or return case data when asked.",
            "Organisations must record case progress honestly and promptly, and must not claim cases they lack the capacity or mandate to act on.",
            "Organisations must take particular care with cases involving children, and must comply with applicable child-protection law and mandatory-reporting duties.",
            "Organisations must report any suspected data breach involving case data to us without undue delay.",
            "Organisations are solely responsible for the acts and omissions of their staff and volunteers, and for the services they choose to deliver. Aasrah does not supervise, direct, employ, or vouch for them.",
          ],
        },
        {
          heading: "Volunteers",
          body: "Volunteers act at their own risk and on their own judgement. Aasrah does not employ volunteers, does not provide insurance, training, supervision, or equipment, and does not guarantee the safety of any assignment. Assess your own safety before attending any case, do not attend alone where circumstances suggest risk, and withdraw from any assignment you are not comfortable with. Nothing in these terms creates an employment, agency, or partnership relationship.",
        },
        {
          heading: "AI-assisted features",
          body: "The platform uses automated processing to draft short case summaries, suggest a priority score, flag potential duplicates, and interpret natural-language searches. These outputs are advisory only, are frequently imperfect, and can be overridden by staff. No decision affecting a person is taken by automated means alone, and no AI output should be treated as a finding of fact about anyone. Report text is processed by a third-party model provider as described in our Privacy Policy.",
        },
        {
          heading: "Limitation of liability",
          body: [
            "To the maximum extent permitted by law, Aasrah and its operators are not liable for any indirect, incidental, special, consequential, or punitive loss, or for loss of profits, data, goodwill, or opportunity, arising from your use of the platform.",
            "In particular, and to the extent the law permits, we are not liable for harm resulting from a report not being read, claimed, or acted upon; from delay in response; from the acts or omissions of any partner organisation, volunteer, or other user; or from the accuracy of any report or AI-generated output.",
            "Our total aggregate liability arising out of or relating to the platform is limited to one thousand rupees (INR 1,000).",
            "Nothing in these terms excludes or limits liability that cannot lawfully be excluded or limited, including liability for death or personal injury caused by our negligence, or for fraud.",
          ],
        },
        {
          heading: "Indemnity",
          body: "You agree to indemnify Aasrah against claims, losses, and reasonable costs arising from your breach of these terms, from content you submit, or from your unlawful use of the platform. This does not apply to claims arising from our own breach or negligence.",
        },
        {
          heading: "Availability and changes",
          body: "The platform is offered in India and is intended for use in India only. We may modify, suspend, or discontinue any part of the service, and may update these terms. Where a change materially affects your rights we will make it evident rather than silently amending the text, and the date at the top always reflects the current version. Continuing to use the platform after a change means you accept it.",
        },
        {
          heading: "Governing law and jurisdiction",
          body: "These terms are governed by the laws of India, without regard to conflict-of-laws principles. The courts of India have exclusive jurisdiction over any dispute arising out of or relating to these terms or the platform. Nothing here limits any right you have under the Digital Personal Data Protection Act, 2023, including your right to complain to the Data Protection Board of India.",
        },
        {
          heading: "Contact",
          body: "Questions about these terms, reports of misuse, and grievances relating to personal data can be sent to chandanp24107@gmail.com. Data-protection grievances are handled by our Grievance Officer under the process set out in the Privacy Policy.",
        },
      ]}
    />
  );
}
