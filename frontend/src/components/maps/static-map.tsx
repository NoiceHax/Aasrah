"use client";

import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="transform:translate(-50%,-100%)">
    <svg width="28" height="36" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 11 16 24 16 24s16-13 16-24C32 7.16 24.84 0 16 0z" fill="#4648d4"/>
      <circle cx="16" cy="16" r="6" fill="#fff"/>
    </svg></div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
});

/** Read-only map showing a single point (used on the Track page). */
export function StaticMap({ lat, lng, zoom = 15 }: { lat: number; lng: number; zoom?: number }) {
  return (
    <div className="h-56 w-full overflow-hidden rounded-lg border border-outline-variant">
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
    </div>
  );
}
