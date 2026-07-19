"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Leaflet needs the DOM, so the picker is loaded client-side only. */
export const DynamicLocationPicker = dynamic(
  () => import("./location-picker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    ),
  },
);

export type { LatLng } from "./location-picker";
