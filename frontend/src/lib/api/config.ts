/**
 * Single source of truth for the backend location.
 *
 * These are `NEXT_PUBLIC_*` vars, so they are inlined at build time. Setting
 * them in Vercel after a deploy has no effect until you redeploy. When they are
 * missing, a production build fails fast in `next.config.ts` rather than
 * shipping a bundle that quietly calls localhost from the visitor's browser.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:8000";
