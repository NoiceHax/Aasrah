import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

/**
 * Named Grievance Officer published under s.13 of the Digital Personal Data
 * Protection Act, 2023. The Act requires a *named* point of contact, so this
 * must be a real individual before the platform accepts live reports.
 *
 * TODO: confirm before launch
 */
const GRIEVANCE_OFFICER_NAME = "GRIEVANCE_OFFICER_NAME";

const GRIEVANCE_EMAIL = "chandanp24107@gmail.com";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Aasrah collects, uses, shares, retains, and protects personal data under India's Digital Personal Data Protection Act, 2023.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="July 2026"
      intro="Aasrah coordinates humanitarian response in India. This policy explains what personal data we handle, why, who else receives it, how long we keep it, and the rights you hold under the Digital Personal Data Protection Act, 2023 (DPDP Act). It covers two very different groups of people: those who file reports, and those who are reported about. Please read the section that applies to you."
      sections={[
        {
          heading: "Who we are",
          body: "Aasrah is the Data Fiduciary for the personal data described in this policy — we decide why and how it is processed. The platform operates in India and is intended for use in India only. Where we engage other organisations to process data on our behalf, they act as Data Processors under our instructions and are named in this policy.",
        },
        {
          heading: "Grievance Officer (s.13, DPDP Act)",
          body: [
            `Grievance Officer: ${GRIEVANCE_OFFICER_NAME}`,
            `Email: ${GRIEVANCE_EMAIL}`,
            "We acknowledge every grievance on receipt and respond substantively within 30 days.",
            "If you are not satisfied with our response, or we fail to respond within that period, you may complain to the Data Protection Board of India.",
          ],
        },
        {
          heading: "Two different people, two different situations",
          body: "Almost every report on Aasrah involves at least two people. The reporter is someone who chooses to use the platform and can decide what to share. The person being reported on — someone found homeless, missing, injured, or otherwise in distress — usually has no idea a report exists and has given us nothing. We treat their data as the more sensitive of the two, and the sections below deal with each separately rather than blurring them together.",
        },
        {
          heading: "Data we hold about the reporter",
          body: [
            "Reports may be filed entirely anonymously. If you file anonymously and provide no contact details, we hold no identifying information about you.",
            "If you choose to supply them, we store the reporter name and phone number you enter, so responders can verify details and follow up.",
            "If you hold an account (volunteer or NGO staff), we hold your email address, a securely hashed password, and optionally your full name and phone number.",
            "Volunteer profiles additionally hold whatever you choose to add: skills, certifications, languages, availability and schedule, working radius, an emergency contact, an optional profile photo, and an optional approximate home location used to match you to nearby cases.",
            "Operational records: your IP address and the actions you take are written to our audit log, and account activity is recorded for security purposes.",
          ],
        },
        {
          heading: "Data we hold about the person being reported on",
          body: [
            "A free-text description of the person and their situation, written by the reporter.",
            "Photographs, where the reporter uploads them.",
            "Precise GPS coordinates and a street address for where the person was seen.",
            "Situation category, number of people present, whether children are present, and whether the reporter has stated that the person is a minor.",
            "Case-handling data: status, priority, an AI-generated one-line summary, timeline of actions taken, internal notes written by NGO staff, and any attachments added during the case.",
            "This person has not consented and, in most cases, cannot be asked. We rely on the legitimate uses below, keep the data to what is genuinely needed to reach and help them, and delete the most sensitive parts on the schedule set out under Retention.",
          ],
        },
        {
          heading: "Why we are allowed to process this data (s.7, DPDP Act)",
          body: [
            "For the person being reported on, we rely on the legitimate uses in section 7 of the DPDP Act: responding to a medical emergency or a threat to the life or immediate health of that person, providing medical treatment or health services during an epidemic, outbreak, or other threat to public health, and providing assistance or services during a disaster or a breakdown of public order.",
            "For reporters, volunteers, and NGO staff, we process data with your consent, given when you file a report or create an account, and for the purposes necessary to provide the service you asked for.",
            "The DPDP Act contains no general 'legitimate interests' ground, and we do not claim one. We do not process any of this data for advertising, profiling, or marketing, and we never sell it.",
          ],
        },
        {
          heading: "Who receives this data",
          body: [
            "Verified NGO partners: an unclaimed case is visible to verified partner organisations working in that area so that one of them can take it on, and once an organisation claims a case, its authorised staff see the full case content — description, photographs, and precise location — because they need it to find the person. The reporter's name and phone number go only to the claiming organisation.",
          "Assigned volunteers: where an organisation assigns a volunteer to attend a case, that volunteer receives the case detail needed to carry out the visit.",
          "Platform administrators: a small number of Aasrah administrators can access case data for support, moderation, and safety purposes.",
            "NVIDIA (NVIDIA NIM API, hosted in the United States): the report text — the situation type, description, address, people count, and children-present flag — is sent to a hosted language model to produce a short triage summary and to interpret natural-language case searches by NGO staff. This is a transfer of report text outside India.",
            "Photographs are not sent to NVIDIA or to any other third party. Automated image analysis is disabled on this platform; images are stored by us and shown only to the claiming NGO and to platform administrators.",
            "OpenStreetMap Foundation (Nominatim): latitude and longitude are sent to the public Nominatim service to convert coordinates into a readable street address, and place names are sent to look up coordinates. No name, phone number, description, or photograph is included in these requests.",
            "Service providers we use to run the platform, such as our hosting provider and our email delivery provider, which processes email addresses to send account and case notifications.",
            "Law enforcement or other authorities, where we are legally obliged to disclose, or where disclosure is necessary to protect someone's life or safety.",
            "We do not sell personal data, and we do not share it with advertisers or data brokers.",
          ],
        },
        {
          heading: "Anonymous reports and public case tracking",
          body: "You can file a report without an account and without giving your name or number. Anyone holding a report's tracking ID can look up that case's progress, but that public view deliberately shows only the situation type, status, priority, a coarse locality, and the timeline — never the description, the photographs, the precise coordinates, or the reporter's contact details. The lookup is rate-limited to make it impractical to guess tracking IDs at scale.",
        },
        {
          heading: "How long we keep it",
          body: [
            "Photographs and precise GPS coordinates: deleted 90 days after the case is closed. These are the most sensitive items we hold and they are removed first.",
            "Reporter name and phone number: deleted 180 days after the report is filed.",
            "Case record — tracking ID, situation type, status, priority, timeline, and coarse area only: kept for 3 years, so partners can demonstrate what was done and we can detect duplicate and repeat cases.",
            "Audit logs: kept for 3 years for security and accountability purposes.",
            "Account data for volunteers and NGO staff: kept while the account is active, and deleted when the account is closed, except where we must retain a record to meet a legal obligation.",
          ],
        },
        {
          heading: "Your rights and how to use them",
          body: [
            "Access: you may ask for a summary of the personal data we hold about you, what we do with it, and the identities of others with whom we have shared it.",
            "Correction and completion: you may ask us to correct inaccurate data or complete data that is incomplete. If you reported something inaccurately, tell us — an inaccurate description can send responders to the wrong person.",
            "Erasure: you may ask us to delete your personal data. We will do so unless we are required to keep it to comply with a law, or unless it forms part of an active case record where removal would obstruct an ongoing response to someone at risk. If we cannot delete something, we will tell you which exemption applies and when it will be deleted under the retention schedule above.",
            "Nominate: you may nominate another individual to exercise these rights on your behalf in the event of your death or incapacity.",
            "Grievance redressal: you may raise a grievance with our Grievance Officer, and escalate to the Data Protection Board of India if you are unsatisfied.",
            `To exercise any of these, email ${GRIEVANCE_EMAIL}. We may ask you to verify your identity before we act, so that we do not disclose someone else's data to the wrong person. If your report was anonymous, quote your tracking ID — without it we may have no way to link the data to you.`,
            "If you are, or are acting for, a person who has been reported on and you want that report's photographs, location, or description removed, contact the Grievance Officer. We will act on such requests as a priority.",
          ],
        },
        {
          heading: "Children's data",
          body: "Reports frequently concern children, and reporters can flag that the person being reported on is a minor. We do not knowingly allow anyone under 18 to create an account on Aasrah. Where a report concerns a child, we process only what is needed to get that child help, apply the same 90-day deletion rule to photographs and precise coordinates, and restrict visibility to the claiming NGO and platform administrators. We never use a child's data for tracking, advertising, or behavioural monitoring.",
        },
        {
          heading: "How we protect it",
          body: [
            "Role-based access control: every account holds a role — volunteer, NGO staff, or administrator — and each role sees a different slice of the platform. Case content is never public: it is available only to signed-in verified partner accounts, assigned volunteers, and administrators.",
            "Reporter contact details are scoped more tightly still: the reporter's name and phone number are released only to the organisation that has claimed the case, and to administrators. Other organisations viewing a case do not receive them.",
            "Discovery of unclaimed cases is limited to verified organisations operating within their declared service radius, and once a case is claimed, other organisations lose access to it.",
            "All traffic between your device and our servers is encrypted in transit using HTTPS.",
            "Passwords are stored only as salted hashes, never in a readable form.",
            "Uploaded images are validated and re-encoded on upload, which discards embedded EXIF metadata — including any GPS coordinates recorded by the camera — before the image is stored.",
            "An append-only audit log records significant changes to a case — who claimed it, changed its status, overrode its priority, added notes or attachments, or assigned volunteers — together with the acting account and the IP address it acted from. To be precise: this log records actions taken on data, not every occasion on which someone viewed it.",
            "Rate limiting on authentication, report submission, and public tracking lookups, and short-lived, single-purpose tokens for anonymous image uploads.",
            "Being straight with you about a limit: we do not currently encrypt data at rest on our servers, and this policy will be updated when we do. Access to the underlying systems is restricted to a small number of administrators.",
          ],
        },
        {
          heading: "If something goes wrong (s.8(6), DPDP Act)",
          body: "If a personal data breach occurs, we will notify the Data Protection Board of India and every affected Data Principal, in the form and within the timeframes required by the DPDP Act and its rules. Our notice will describe what happened, the data involved, the likely consequences, what we are doing about it, and the steps you can take to protect yourself. We will do this whether or not the breach reflects well on us.",
        },
        {
          heading: "Changes to this policy",
          body: "We will update this policy as the platform changes, and the date at the top always reflects the current version. Where a change materially affects how we handle your data — a new recipient, a new purpose, or a shorter or longer retention period — we will make that clear rather than quietly editing the text.",
        },
      ]}
    />
  );
}
