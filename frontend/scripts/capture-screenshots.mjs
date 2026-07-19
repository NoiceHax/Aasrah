// Capture product screenshots of the running app with Playwright.
// Usage: node scripts/capture-screenshots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const FRONTEND = "http://localhost:3000";
const API = "http://localhost:8000/api/v1";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/screenshots");
mkdirSync(OUT, { recursive: true });

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email} failed: ${res.status}`);
  return res.json();
}

async function seedAuth(context, session) {
  // Mirror the frontend tokenStore keys so the app treats us as logged in.
  await context.addInitScript((s) => {
    localStorage.setItem("aasrah.access", s.tokens.access_token);
    localStorage.setItem("aasrah.refresh", s.tokens.refresh_token);
    localStorage.setItem("aasrah.user", JSON.stringify(s.user));
  }, session);
}

async function shot(page, url, file, { full = true, waitFor } = {}) {
  await page.goto(`${FRONTEND}${url}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200); // let React Query + maps settle
  if (waitFor) await page.locator(waitFor).first().waitFor({ timeout: 8000 }).catch(() => {});
  // Scroll through the page so Framer Motion `whileInView` (scroll-reveal)
  // sections animate in; otherwise they stay at opacity 0 in a full-page shot.
  await page.evaluate(async () => {
    const step = Math.floor(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 180));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  await page.screenshot({ path: path.join(OUT, file), fullPage: full });
  console.log("captured", file);
}

async function main() {
  const [ngo, vol, admin, claimedCaseId] = await (async () => {
    const ngoS = await login("ngo@aasrah.org", "NgoPass123!");
    const volS = await login("vol1@aasrah.org", "VolPass123!");
    const adminS = await login("admin@aasrah.org", "ChangeMe123!");
    const claimed = await fetch(`${API}/ngo/reports/claimed?page_size=1`, {
      headers: { Authorization: `Bearer ${ngoS.tokens.access_token}` },
    }).then((r) => r.json());
    return [ngoS, volS, adminS, claimed.items?.[0]?.id];
  })();

  const browser = await chromium.launch();
  const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
  // Force reduced-motion so scroll-reveal (Framer Motion) sections aren't blank
  // in a full-page screenshot; our CSS disables those animations under it.
  const desktopStatic = { ...desktop, reducedMotion: "reduce" };

  // Public pages (no auth).
  {
    const ctx = await browser.newContext(desktopStatic);
    const page = await ctx.newPage();
    await shot(page, "/", "01-landing.png");
    await shot(page, "/report", "02-report.png");
    await shot(page, "/track", "03-track.png");
    await shot(page, "/about", "04-about.png");
    await ctx.close();
  }

  // NGO portal.
  {
    const ctx = await browser.newContext(desktopStatic);
    await seedAuth(ctx, ngo);
    const page = await ctx.newPage();
    await shot(page, "/portal", "05-ngo-dashboard.png");
    await shot(page, "/portal/reports", "06-ngo-reports.png");
    if (claimedCaseId) await shot(page, `/portal/cases/${claimedCaseId}`, "07-ngo-case-detail.png");
    await shot(page, "/portal/analytics", "08-ngo-analytics.png");
    await ctx.close();
  }

  // Volunteer portal.
  {
    const ctx = await browser.newContext(desktopStatic);
    await seedAuth(ctx, vol);
    const page = await ctx.newPage();
    await shot(page, "/volunteer-portal", "09-volunteer-dashboard.png");
    await shot(page, "/volunteer-portal/performance", "10-volunteer-performance.png");
    await ctx.close();
  }

  // Admin console.
  {
    const ctx = await browser.newContext(desktopStatic);
    await seedAuth(ctx, admin);
    const page = await ctx.newPage();
    await shot(page, "/admin", "11-admin-dashboard.png");
    await shot(page, "/admin/insights", "12-admin-insights.png");
    await shot(page, "/admin/monitoring", "13-admin-monitoring.png");
    await ctx.close();
  }

  await browser.close();
  console.log("Done. Screenshots in", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
