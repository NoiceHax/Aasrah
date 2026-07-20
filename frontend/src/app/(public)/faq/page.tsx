import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/ui/section";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Aasrah: reporting, volunteering, NGOs, the platform, and more.",
};

const faqGroups = [
  {
    id: "reporting",
    label: "Reporting",
    icon: "add_alert",
    items: [
      {
        id: "r1",
        question: "Who can submit a report?",
        answer:
          "Anyone can report a person in need. No account is required. Reports can be filed anonymously. You only need a rough location and a brief description; photos are optional but helpful.",
      },
      {
        id: "r2",
        question: "What happens after I submit a report?",
        answer:
          "You receive a unique Report ID immediately. The report is visible to all verified NGOs operating in the area. An NGO will claim and begin managing it, updating the status as the situation progresses.",
      },
      {
        id: "r3",
        question: "How do I track a report I submitted?",
        answer:
          "Use the Track Report page and enter your Report ID. You'll see the current status in real time: from Pending through to Claimed, En Route, and Resolved.",
      },
      {
        id: "r4",
        question: "Can I upload photos with a report?",
        answer:
          "Yes. You can attach up to 6 images per report. Photos help NGOs assess the situation before dispatching volunteers, which speeds up the response.",
      },
      {
        id: "r5",
        question: "What if the situation is urgent and requires immediate emergency services?",
        answer:
          "Aasrah is not a substitute for emergency services and does not provide emergency dispatch. If someone's life is in immediate danger, call 112 (all emergencies), 108 (ambulance), 1098 (child helpline) or 181 (women's helpline) first, then file the report. Aasrah coordinates humanitarian support afterwards.",
      },
      {
        id: "r6",
        question: "Can I edit or delete a report after submitting?",
        answer:
          "Anonymous reports cannot be edited after submission, as there is no account to authenticate with. If you have critical corrections, note them in a follow-up using the tracking page's comment field, or contact the claiming NGO directly.",
      },
    ],
  },
  {
    id: "ngos",
    label: "NGOs & Partners",
    icon: "corporate_fare",
    items: [
      {
        id: "n1",
        question: "How are NGOs verified?",
        answer:
          "Partner NGOs go through a documentation and credential review by the Aasrah admin team before they can join the platform. Verification status is always visible on NGO profiles and throughout the app.",
      },
      {
        id: "n2",
        question: "How does an NGO join Aasrah?",
        answer:
          "NGO accounts are provisioned by the Aasrah admin team. There is no public self-registration for organisations. If you represent an NGO interested in partnering, use the Contact page to reach out.",
      },
      {
        id: "n3",
        question: "Can multiple NGOs respond to the same report?",
        answer:
          "No. To avoid duplicated or conflicting responses, reports are claimed exclusively: one NGO claims a case and owns it. Other NGOs will see it as claimed and can focus on unclaimed reports.",
      },
      {
        id: "n4",
        question: "What does an NGO see on the platform?",
        answer:
          "Verified NGOs get a full operations portal: a discovery feed of nearby unclaimed reports, case management with status tracking, volunteer assignment, analytics, and notifications.",
      },
      {
        id: "n5",
        question: "How do I donate to an NGO?",
        answer:
          "Visit the Donate page. Each verified NGO is listed there with a link to their own donation page. Aasrah does not process or hold donations; funds go directly to the NGO.",
      },
    ],
  },
  {
    id: "volunteering",
    label: "Volunteering",
    icon: "volunteer_activism",
    items: [
      {
        id: "v1",
        question: "How do I become a volunteer?",
        answer:
          "Register for an account on Aasrah. All new accounts are created as volunteers. Once registered, complete your profile and wait for admin approval before you can accept assignments.",
      },
      {
        id: "v2",
        question: "Can I volunteer remotely?",
        answer:
          "Yes. Dispatch coordination, translation, and case triage roles are fully remote and flexible around your schedule. Field responder roles require physical presence.",
      },
      {
        id: "v3",
        question: "Can I choose which NGO I work with?",
        answer:
          "Yes. In your volunteer profile you can set your assignment mode: either independent (matched to any NGO's cases) or NGO-affiliated (linked to a specific partner organisation).",
      },
      {
        id: "v4",
        question: "What happens after I accept an assignment?",
        answer:
          "You'll receive case details and can update your status (En Route, Arrived, In Progress, Completed) from your volunteer portal. The NGO and platform track your progress in real time.",
      },
      {
        id: "v5",
        question: "Is there a minimum commitment required?",
        answer:
          "No fixed minimum. You set your own availability in your profile. Some roles like dispatch coordination suggest around 4 hours per week, but this is guidance, not a requirement.",
      },
    ],
  },
  {
    id: "platform",
    label: "Platform & Technical",
    icon: "devices",
    items: [
      {
        id: "p1",
        question: "Is Aasrah free to use?",
        answer:
          "Yes, completely free for reporters, volunteers, and NGOs. Aasrah is a humanitarian platform: there are no fees, subscriptions, or paid tiers.",
      },
      {
        id: "p2",
        question: "Does Aasrah work on mobile?",
        answer:
          "Yes. The platform is a Progressive Web App (PWA). It works in any modern browser on mobile or desktop. You can also install it to your home screen for a native-app-like experience.",
      },
      {
        id: "p3",
        question: "Can I use Aasrah offline?",
        answer:
          "The PWA caches the app shell so it loads when offline. However, submitting reports, tracking cases, and viewing live data all require an internet connection.",
      },
      {
        id: "p4",
        question: "How is my data handled?",
        answer:
          "Reports can be submitted anonymously. If you create an account, your data is stored securely and never sold. See the Privacy Policy for full details.",
      },
      {
        id: "p5",
        question: "I found a bug or the platform isn't working. What do I do?",
        answer:
          "Contact the developer directly at the email on the Contact page. Include a description of what you were doing, what you expected, and what happened instead. Screenshots are helpful.",
      },
      {
        id: "p6",
        question: "How do I reset my password?",
        answer:
          "Use the 'Forgot password' link on the login page. If you don't receive the reset email within a few minutes, check your spam folder. If it still doesn't arrive, contact the developer.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="Help centre"
        title="Frequently asked questions"
        description="Everything you need to know about reporting, volunteering, NGO partnerships, and the platform."
      />

      <Section surface="default">
        <div className="mx-auto max-w-3xl flex flex-col gap-12">
          {faqGroups.map((group) => (
            <div key={group.id}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant">
                  <Icon name={group.icon} className="text-[18px]" />
                </div>
                <h2 className="text-headline-sm text-primary">{group.label}</h2>
              </div>
              <Accordion items={group.items} />
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-outline-variant bg-surface-container-low p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-fixed text-on-secondary-fixed-variant">
            <Icon name="help" className="text-[22px]" />
          </div>
          <h3 className="text-headline-sm text-primary">Still have questions?</h3>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            For technical platform issues, reach out to the developer. For NGO-specific queries, contact the organisation directly.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button href={routes.contact} variant="secondary" leadingIcon="mail">
              Contact support
            </Button>
            <Button href={routes.donate} variant="outline" leadingIcon="volunteer_activism">
              Support an NGO
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
