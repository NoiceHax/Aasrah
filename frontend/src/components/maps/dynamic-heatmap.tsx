"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const DynamicHeatmap = dynamic(() => import("./heatmap").then((m) => m.Heatmap), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});
