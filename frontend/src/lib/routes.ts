/** Central route registry: single source of truth for links across the app. */
export const routes = {
  home: "/",
  about: "/about",
  report: "/report",
  track: "/track",
  volunteer: "/volunteer",
  donate: "/donate",
  contact: "/contact",
  faq: "/faq",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  volunteerPortal: "/volunteer-portal",
} as const;

/** The portal landing path for a given user role. */
export function portalPathForRole(role: string | undefined): string | null {
  switch (role) {
    case "ngo":
      return "/portal";
    case "volunteer":
      return "/volunteer-portal";
    case "admin":
      return "/admin";
    default:
      return null;
  }
}

export type NavLink = {
  label: string;
  href: string;
};

/** Primary navigation shown in the navbar. */
export const mainNav: NavLink[] = [
  { label: "Home", href: routes.home },
  { label: "About", href: routes.about },
  { label: "Volunteer", href: routes.volunteer },
  { label: "Donate", href: routes.donate },
  { label: "Track Report", href: routes.track },
  { label: "FAQ", href: routes.faq },
  { label: "Contact", href: routes.contact },
];

/** Footer link groups. */
export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "Report a Person", href: routes.report },
      { label: "Track a Report", href: routes.track },
      { label: "Volunteer", href: routes.volunteer },
      { label: "Donate", href: routes.donate },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: routes.about },
      { label: "FAQ", href: routes.faq },
      { label: "Contact", href: routes.contact },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
];
