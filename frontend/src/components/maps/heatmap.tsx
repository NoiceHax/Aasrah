"use client";

import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import type { HeatmapPoint } from "@/lib/api/types";

/** Lightweight "heatmap" using weighted circle markers (no extra plugin). */
export function Heatmap({ points }: { points: HeatmapPoint[] }) {
  const center: [number, number] = points.length
    ? [
        points.reduce((s, p) => s + p.latitude, 0) / points.length,
        points.reduce((s, p) => s + p.longitude, 0) / points.length,
      ]
    : [20, 0];

  return (
    <div className="h-56 w-full overflow-hidden rounded-lg border border-outline-variant">
      <MapContainer center={center} zoom={points.length ? 12 : 3} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.latitude, p.longitude]}
            radius={8 + p.weight * 2}
            pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.35, weight: 1 }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
