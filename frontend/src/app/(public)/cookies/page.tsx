import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Aasrah sets no cookies and runs no analytics or advertising trackers. What we do store on your device, and why.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="July 2026"
      intro="Aasrah does not use cookies. We set none from our servers, none from the browser, and we run no analytics, advertising, or tracking services of any kind. Because of that there is nothing to consent to and no consent banner to click through. This page explains the small amount of data the platform does keep on your device in order to work at all."
      sections={[
        {
          heading: "We do not use cookies",
          body: "Neither the Aasrah website nor its API sets a cookie. There are no session cookies, no persistent identifiers, no cross-site cookies, and no third-party cookies. Because we set no cookies, we do not ask you to accept any, and the platform does not display a cookie consent banner.",
        },
        {
          heading: "No analytics, no advertising, no tracking",
          body: [
            "We do not use Google Analytics, Plausible, PostHog, or any other web analytics product.",
            "We do not use advertising networks, retargeting pixels, conversion tags, or social media trackers.",
            "We do not build profiles of visitors, and we do not sell or share behavioural data. There is nothing to opt out of.",
            "The 'Analytics' section inside the partner portal is something different: it is our own dashboard showing an organisation its own case statistics. It involves no third-party tracking.",
          ],
        },
        {
          heading: "What we store on your device instead",
          body: [
            "Local storage — sign-in: if you sign in, your browser keeps your access token, refresh token, and basic account details (name, email, role) in local storage so you stay signed in between page loads. These are strictly necessary to operate the service and are read only by Aasrah.",
            "These items are not transmitted automatically the way cookies are; they are attached to requests only when the app calls our API on your behalf.",
            "Signing out clears them. Clearing your browser's site data for Aasrah removes them too, and will sign you out.",
            "If you browse without signing in — including filing an anonymous report — we store nothing persistent on your device for that purpose.",
          ],
        },
        {
          heading: "Service worker and offline support",
          body: "Aasrah installs a service worker so the app can be added to your home screen and remain usable on a poor connection. It may cache application files — the interface itself — in your browser's cache storage. This is a technical necessity of an installable app, not a tracking mechanism, and it holds no identifier for you. Uninstalling the app or clearing site data removes it.",
        },
        {
          heading: "Push notifications",
          body: "If, and only if, you explicitly grant notification permission, your browser creates a push subscription that we store so we can alert you about case activity. This is opt-in, is never enabled by default, and can be withdrawn at any time by revoking notification permission in your browser settings. If you never grant permission, no subscription exists.",
        },
        {
          heading: "Server logs",
          body: "Separately from anything stored on your device, our servers record ordinary operational data, including IP addresses associated with significant actions in our audit log. This is described in the Privacy Policy under How we protect it and Retention, and is not done through cookies.",
        },
        {
          heading: "Managing what is stored",
          body: "You can clear local storage, cache storage, and any push subscription at any time through your browser's privacy or site-data settings for this site. Because the items we store are strictly necessary, clearing them while signed in will sign you out and you will need to sign in again. Filing and tracking a report anonymously does not require any of it.",
        },
        {
          heading: "If this changes",
          body: "If we ever introduce cookies or any non-essential tracking, we will update this page before doing so and obtain your consent where the law requires it. The date at the top reflects the current version.",
        },
      ]}
    />
  );
}
