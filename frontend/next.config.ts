import type { NextConfig } from "next";

// NEXT_PUBLIC_* values are inlined at build time. Without them a production
// build silently ships a bundle that calls http://localhost:8000 from the
// visitor's own machine, which fails as a network error (and trips Chrome's
// local network access prompt). Fail the build instead.
if (process.env.NODE_ENV === "production") {
  const missing = [
    "NEXT_PUBLIC_API_BASE_URL",
    "NEXT_PUBLIC_API_ORIGIN",
  ].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required build-time env vars: ${missing.join(", ")}. ` +
        `Set them in your hosting provider and redeploy (see docs/DEPLOYMENT.md).`,
    );
  }
}

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't infer it from an unrelated
  // lockfile higher up the directory tree.
  turbopack: {
    root: __dirname,
  },
  // Emit a self-contained server bundle for a lean production Docker image.
  output: "standalone",
};

export default nextConfig;
