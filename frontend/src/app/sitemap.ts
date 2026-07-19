import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";
import { routes } from "@/lib/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const publicPaths = [
    routes.home,
    routes.about,
    routes.report,
    routes.track,
    routes.volunteer,
    routes.donate,
    routes.contact,
    "/privacy",
    "/terms",
    "/cookies",
  ];

  return publicPaths.map((path) => ({
    url: `${siteConfig.url}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: path === routes.home ? "weekly" : "monthly",
    priority: path === routes.home ? 1 : 0.7,
  }));
}
