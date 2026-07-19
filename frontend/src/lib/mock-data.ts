/**
 * Static marketing/content copy for the public-facing site.
 *
 * NOTE: This file holds only genuine, non-fabricated product content: how the
 * platform works, its values, the kinds of volunteer roles, donation tiers, and
 * FAQs. It deliberately contains NO fabricated statistics, fake NGOs, fake
 * testimonials, or fake team members. Live figures (rescues, NGOs, volunteers)
 * come from the public `/stats` API; real NGOs come from `/stats/ngos`.
 */

export type HowItWorksStep = {
  id: string;
  step: number;
  icon: string;
  title: string;
  description: string;
  accent: "secondary" | "primary" | "success";
};

export const howItWorks: HowItWorksStep[] = [
  {
    id: "report",
    step: 1,
    icon: "add_alert",
    title: "Report",
    description:
      "Anyone can report a person in need. No account required. Just provide a location, photos, and details. A tracking ID is issued instantly.",
    accent: "secondary",
  },
  {
    id: "claim",
    step: 2,
    icon: "assignment_turned_in",
    title: "NGO Claims",
    description:
      "Verified partner NGOs evaluate the report and claim the case based on resources and proximity.",
    accent: "primary",
  },
  {
    id: "rescue",
    step: 3,
    icon: "volunteer_activism",
    title: "Rescue",
    description:
      "Volunteers are dispatched to provide immediate support and coordinate long-term help.",
    accent: "success",
  },
];

export type Value = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

export const values: Value[] = [
  {
    id: "transparency",
    icon: "visibility",
    title: "Radical Transparency",
    description:
      "Every report, claim, and rescue is auditable. Donors and communities can trace impact end to end.",
  },
  {
    id: "speed",
    icon: "bolt",
    title: "Controlled Urgency",
    description:
      "We design for decisive action under pressure: clear hierarchy, no noise, the right tools at the right moment.",
  },
  {
    id: "trust",
    icon: "verified_user",
    title: "Verified Trust",
    description:
      "NGOs are vetted before they can claim cases. Semantic status colors mean a red marker always means the same thing.",
  },
  {
    id: "community",
    icon: "diversity_3",
    title: "Community First",
    description:
      "Community-led care is the backbone. We give communities the digital infrastructure to look after their own.",
  },
];

export type VolunteerRole = {
  id: string;
  title: string;
  commitment: string;
  icon: string;
  description: string;
  skills: string[];
};

export const volunteerRoles: VolunteerRole[] = [
  {
    id: "field",
    title: "Field Responder",
    commitment: "On-call shifts",
    icon: "directions_run",
    description:
      "Be dispatched to verified cases nearby to provide first-line support and coordinate handoffs.",
    skills: ["First Aid", "Local knowledge", "Driving license"],
  },
  {
    id: "coordinator",
    title: "Dispatch Coordinator",
    commitment: "Remote, 4h/week",
    icon: "hub",
    description:
      "Triage incoming reports, match cases to responders, and keep timelines moving from anywhere.",
    skills: ["Communication", "Calm under pressure", "Organization"],
  },
  {
    id: "medic",
    title: "Medical Volunteer",
    commitment: "Flexible",
    icon: "medical_services",
    description:
      "Provide medical assessment and care on rescues that require a clinical presence.",
    skills: ["Licensed clinician", "Emergency care", "Empathy"],
  },
  {
    id: "translator",
    title: "Translator",
    commitment: "Remote, flexible",
    icon: "translate",
    description:
      "Bridge language gaps between reporters, responders, and the people we serve.",
    skills: ["Bilingual+", "Cultural fluency", "Patience"],
  },
];

export type DonationTier = {
  id: string;
  amount: number;
  title: string;
  impact: string;
  popular?: boolean;
};

export const donationTiers: DonationTier[] = [
  { id: "t25", amount: 25, title: "Supporter", impact: "Equips one volunteer with a response kit." },
  {
    id: "t75",
    amount: 75,
    title: "Advocate",
    impact: "Funds dispatch coordination for a full week.",
    popular: true,
  },
  { id: "t200", amount: 200, title: "Guardian", impact: "Powers an entire rescue, end to end." },
];

export type Faq = {
  id: string;
  question: string;
  answer: string;
};

export const faqs: Faq[] = [
  {
    id: "f1",
    question: "Who can submit a report?",
    answer:
      "Anyone can report a person in need. No account is required. Reports can be filed anonymously and are always reviewed.",
  },
  {
    id: "f2",
    question: "How are NGOs verified?",
    answer:
      "Partner NGOs go through a documentation and credential review before they can claim cases on the platform. Verification status is visible throughout the app.",
  },
  {
    id: "f3",
    question: "Is my donation tax-deductible?",
    answer:
      "Aasrah is a registered non-profit. Donations are tax-deductible in most regions; you'll receive a receipt by email immediately after donating.",
  },
  {
    id: "f4",
    question: "Can I volunteer remotely?",
    answer:
      "Yes. Several roles (dispatch coordination, translation, and case triage) are fully remote and flexible around your schedule.",
  },
  {
    id: "f5",
    question: "How do I track a report I submitted?",
    answer:
      "Use the Track Report page with the Report ID issued when you submitted. You'll see live status as NGOs claim and resolve the case.",
  },
];
