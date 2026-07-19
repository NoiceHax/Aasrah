"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const DynamicStaticMap = dynamic(
  () => import("./static-map").then((m) => m.StaticMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-56 w-full" />,
  },
);
