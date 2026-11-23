"use client";

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { Expand } from "@/components/motion/expand";
import { secondaryButton } from "@/components/profile/styles";
import { directionsUrl } from "@/components/applications/format";
import { cn } from "@/lib/utils";
import type { Schemas } from "@/lib/api-client";

// One loader for the component and the hover/focus warm-up, so the chunk is requested once.
const loadStudentLocationMap = () =>
  import("@/components/applications/student-location-map");
// Starts the map's download when the toggle is hovered or focused, before the press.
const warmMap = () => void loadStudentLocationMap();

// Loaded on first open only, so a Maps load (billed per map) happens only when the tutor asks for it.
const StudentLocationMap = dynamic(
  () => loadStudentLocationMap().then((m) => m.StudentLocationMap),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="h-48 w-full rounded-[12px] border border-[var(--color-border-control)] bg-[var(--color-surface-subtle)] sm:h-56"
      />
    ),
  },
);

export function StudentLocation({
  location,
}: {
  location: Schemas["ApplicationStudentLocation"];
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { address, lat, lng } = location;
  const hasPin = lat !== null && lng !== null;
  const showMap = hasPin && !!apiKey;

  const mapId = `${useId()}-map`;
  const [mapOpen, setMapOpen] = useState(false);
  const [mapOpened, setMapOpened] = useState(false);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
        {address}
      </p>
      {showMap && (
        <div className="grid gap-2">
          <button
            type="button"
            aria-expanded={mapOpen}
            aria-controls={mapOpened ? mapId : undefined}
            onPointerEnter={warmMap}
            onFocus={warmMap}
            onClick={() => {
              setMapOpened(true);
              setMapOpen((open) => !open);
            }}
            className={cn(secondaryButton, "justify-self-start")}
          >
            {mapOpen ? "Hide map" : "Show on map"}
          </button>
          <Expand keepMounted id={mapId} open={mapOpen} className="grid">
            <StudentLocationMap apiKey={apiKey} lat={lat} lng={lng} />
          </Expand>
        </div>
      )}
      {!hasPin && (
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          The exact pin isn&apos;t available, so directions use the address.
        </p>
      )}
      <a
        href={directionsUrl(location)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(secondaryButton, "justify-self-start")}
      >
        Get directions <span className="sr-only">(opens Google Maps)</span>
      </a>
    </div>
  );
}
