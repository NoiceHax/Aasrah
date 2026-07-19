"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { mapsApi } from "@/lib/api/endpoints";
import { normalizeError } from "@/lib/api/client";
import type { GeocodeResult } from "@/lib/api/types";

export interface LatLng {
  lat: number;
  lng: number;
}

// Default center (a generic world-ish view) until the user locates or searches.
const DEFAULT_CENTER: LatLng = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 3;
const LOCATED_ZOOM = 16;

// Build a custom divIcon so we don't depend on Leaflet's image assets.
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="transform:translate(-50%,-100%)">
    <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 11 16 24 16 24s16-13 16-24C32 7.16 24.84 0 16 0z" fill="#4648d4"/>
      <circle cx="16" cy="16" r="6" fill="#fff"/>
    </svg></div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

/** Pans the map when the controlled value changes. */
function MapPanner({ value, zoom }: { value: LatLng | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.flyTo([value.lat, value.lng], zoom, { duration: 0.6 });
  }, [value, zoom, map]);
  return null;
}

/** Click-to-place handler. */
function ClickHandler({ onPick }: { onPick: (latlng: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

interface LocationPickerProps {
  value: LatLng | null;
  onChange: (value: LatLng, address?: string) => void;
  onError?: (message: string) => void;
}

export function LocationPicker({ value, onChange, onError }: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [targetZoom, setTargetZoom] = useState(DEFAULT_ZOOM);
  const debounceRef = useRef<number | null>(null);

  const center = useMemo<[number, number]>(
    () => (value ? [value.lat, value.lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]),
    [value],
  );

  const reverseAndEmit = useCallback(
    async (latlng: LatLng) => {
      onChange(latlng);
      try {
        const res = await mapsApi.reverse(latlng.lat, latlng.lng);
        onChange(latlng, res.display_name);
      } catch {
        // Reverse geocoding is best-effort; coordinates are still captured.
      }
    },
    [onChange],
  );

  const handlePick = useCallback(
    (latlng: LatLng) => {
      setTargetZoom(LOCATED_ZOOM);
      void reverseAndEmit(latlng);
    },
    [reverseAndEmit],
  );

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      onError?.("Geolocation isn't supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        handlePick({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        onError?.(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. You can search or tap the map instead."
            : "Couldn't determine your location.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [handlePick, onError]);

  // Debounced search: a timer-driven sync between the query input and the
  // geocoding service; clearing results when the query is too short is part
  // of that synchronization.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await mapsApi.search(query.trim()));
      } catch (e) {
        onError?.(normalizeError(e).message);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, onError]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectResult = (r: GeocodeResult) => {
    setQuery(r.display_name);
    setResults([]);
    setTargetZoom(LOCATED_ZOOM);
    onChange({ lat: r.latitude, lng: r.longitude }, r.display_name);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search + locate controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for an address or place"
            className="w-full rounded-md border border-outline-variant bg-surface-container-low py-2.5 pl-10 pr-3 text-body-md outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
          />
          {(searching || results.length > 0) && (
            <div className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest shadow-raised">
              {searching && (
                <p className="px-3 py-2 text-label-sm text-on-surface-variant">Searching…</p>
              )}
              {results.map((r, i) => (
                <button
                  key={`${r.latitude}-${r.longitude}-${i}`}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="block w-full truncate px-3 py-2 text-left text-body-sm hover:bg-surface-container-low"
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={locateMe}
          disabled={locating}
          leadingIcon={locating ? undefined : "my_location"}
        >
          {locating ? "Locating…" : "Use my location"}
        </Button>
      </div>

      {/* Map */}
      <div className="h-72 w-full overflow-hidden rounded-lg border border-outline-variant">
        <MapContainer
          center={center}
          zoom={value ? LOCATED_ZOOM : DEFAULT_ZOOM}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={handlePick} />
          <MapPanner value={value} zoom={targetZoom} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const p = m.getLatLng();
                  handlePick({ lat: p.lat, lng: p.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
        <Icon name="touch_app" className="text-[16px]" />
        Tap the map, drag the pin, search, or use your location to set the spot.
      </p>
    </div>
  );
}
