"use client";

import { APIProvider, AdvancedMarker, Map } from "@vis.gl/react-google-maps";

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const PIN_ZOOM = 15;

/** Read-only pin map. Loaded on its own so the Maps SDK stays out of the initial bundle. */
export function StudentLocationMap({
  apiKey,
  lat,
  lng,
}: {
  apiKey: string;
  lat: number;
  lng: number;
}) {
  const point = { lat, lng };
  return (
    <APIProvider apiKey={apiKey}>
      <div
        role="region"
        aria-label="Student's location map"
        className="h-48 w-full overflow-hidden rounded-[12px] border border-[var(--color-border-control)] sm:h-56"
      >
        <Map
          className="h-full w-full"
          mapId={MAP_ID}
          defaultCenter={point}
          defaultZoom={PIN_ZOOM}
          gestureHandling="cooperative"
          clickableIcons={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
        >
          <AdvancedMarker position={point} title="Student's location" />
        </Map>
      </div>
    </APIProvider>
  );
}
