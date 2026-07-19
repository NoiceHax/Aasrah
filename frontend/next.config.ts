import type { NextConfig } from "next";

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
