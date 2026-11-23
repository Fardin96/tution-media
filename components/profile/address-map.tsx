"use client";

import { useEffect, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { BD_BOUNDS, DEFAULT_CENTER, inBangladesh } from "@/lib/tutor-zones";

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const RESTRICTION = { latLngBounds: BD_BOUNDS, strictBounds: false };
const PIN_ZOOM = 15;
const CITY_ZOOM = 11;

export interface AddressMapProps {
  /** The caller checks that a browser Maps key is set before rendering the map. */
  apiKey: string;
  latitude: number | null;
  longitude: number | null;
  /** placeId is set when the click landed on a named place (a shop, school or building). */
  onPick: (lat: number, lng: number, placeId?: string) => void;
  /** A click or drag landed outside Bangladesh. The pin snaps back to the saved spot. */
  onOutside?: () => void;
  /** A reverse lookup for the pin is in flight. */
  busy?: boolean;
  /** The id of the hint text under the map, read by screen readers. */
  describedById?: string;
}

export function AddressMap({ apiKey, ...props }: AddressMapProps) {
  return (
    <APIProvider apiKey={apiKey}>
      <MapCanvas {...props} />
    </APIProvider>
  );
}

type MapCanvasProps = Omit<AddressMapProps, "apiKey">;

function MapCanvas({
  latitude,
  longitude,
  onPick,
  onOutside,
  busy = false,
  describedById,
}: MapCanvasProps) {
  const hasPin = latitude !== null && longitude !== null;
  // Bumping the key remounts the marker, so a drop outside Bangladesh snaps back to the saved pin.
  const [markerKey, setMarkerKey] = useState(0);

  // Points outside Bangladesh are ignored; the map can be panned past the box.
  const pick = (lat: number, lng: number, placeId?: string): boolean => {
    if (inBangladesh(lat, lng)) {
      onPick(lat, lng, placeId);
      return true;
    }
    onOutside?.();
    return false;
  };

  return (
    <div
      role="region"
      aria-label="Address pin map"
      aria-describedby={describedById}
      aria-busy={busy || undefined}
      className="h-56 w-full overflow-hidden rounded-[12px] border border-[var(--color-border-control)] transition-shadow duration-150 ease-out focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-core)_16%,transparent)] sm:h-64"
    >
      <Map
        className="h-full w-full"
        mapId={MAP_ID}
        defaultCenter={
          hasPin ? { lat: latitude, lng: longitude } : DEFAULT_CENTER
        }
        defaultZoom={hasPin ? PIN_ZOOM : CITY_ZOOM}
        gestureHandling="cooperative"
        restriction={RESTRICTION}
        clickableIcons
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        draggableCursor="crosshair"
        onClick={(event) => {
          const point = event.detail.latLng;
          const placeId = event.detail.placeId;
          // A POI click would open Google's own info window; the address and name come from our lookup.
          if (placeId) event.stop();
          if (point) pick(point.lat, point.lng, placeId ?? undefined);
        }}
      >
        <ViewportSync latitude={latitude} longitude={longitude} />
        {hasPin && (
          <AdvancedMarker
            key={markerKey}
            position={{ lat: latitude, lng: longitude }}
            title="Your spot"
            draggable
            onDragEnd={(event) => {
              const point = event.latLng;
              if (!point) return;
              if (!pick(point.lat(), point.lng())) {
                setMarkerKey((key) => key + 1);
              }
            }}
          />
        )}
      </Map>
    </div>
  );
}

/** Pans to the pin when a suggestion moves it out of view. The user's zoom is left alone. */
function ViewportSync({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || latitude === null || longitude === null) return;
    const point = { lat: latitude, lng: longitude };
    const view = map.getBounds();
    if (!view || !view.contains(point)) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        map.setCenter(point);
      else map.panTo(point);
    }
  }, [map, latitude, longitude]);

  return null;
}
