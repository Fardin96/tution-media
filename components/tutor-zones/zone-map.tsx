"use client";

import { useEffect, useRef } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { BD_BOUNDS, DEFAULT_CENTER, type TutorZone } from "@/lib/tutor-zones";

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const RESTRICTION = { latLngBounds: BD_BOUNDS, strictBounds: false };
const DEFAULT_ZOOM = 11;
const FIT_PADDING = 48;
const METRES_PER_DEGREE = 111_320;

/** Read at call time so tests can stub the env. */
export function hasMapsKey() {
  return !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

// Google Maps overlays need literal colours, not CSS variables.
const COLORS = {
  zone: "#0066ff",
  deep: "#002b6b",
};

type CircleTone = "zone" | "selected" | "draft";

interface CircleStyle {
  strokeColor: string;
  strokeWeight: number;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
  zIndex: number;
}

// Only the parts of google.maps.Circle this file uses.
interface CircleHandle {
  setMap(map: unknown): void;
  setOptions(options: object): void;
  addListener(event: string, handler: () => void): { remove(): void };
}

const CIRCLE_STYLE: Record<CircleTone, CircleStyle> = {
  zone: {
    strokeColor: COLORS.zone,
    strokeWeight: 1.5,
    strokeOpacity: 0.8,
    fillColor: COLORS.zone,
    fillOpacity: 0.1,
    zIndex: 1,
  },
  selected: {
    strokeColor: COLORS.deep,
    strokeWeight: 3,
    strokeOpacity: 1,
    fillColor: COLORS.zone,
    fillOpacity: 0.26,
    zIndex: 2,
  },
  draft: {
    strokeColor: COLORS.deep,
    strokeWeight: 2,
    strokeOpacity: 1,
    fillColor: COLORS.deep,
    fillOpacity: 0.18,
    zIndex: 3,
  },
};

export interface ZoneMapDraft {
  lat: number;
  lng: number;
  radiusM: number;
}

export interface ZoneMapProps {
  zones: TutorZone[];
  draft: ZoneMapDraft | null;
  selectedId: string | null;
  /** Set only while editing. Pin drags call it; map clicks call it only in drop-pin mode. */
  onPick?: (lat: number, lng: number) => void;
  onSelect: (id: string) => void;
  /** Drop-pin mode: the next map click or tap places the pin. */
  dropping?: boolean;
}

export function ZoneMap(props: ZoneMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div
        role="region"
        aria-label="Zone map"
        className="flex h-full w-full items-center justify-center bg-[var(--color-surface-subtle)] p-6 text-center"
      >
        <p className="max-w-sm text-sm text-pretty text-[var(--color-text-secondary)]">
          Map preview is unavailable. You can still search for a place and set
          the radius.
        </p>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Zone map" className="h-full w-full">
      <APIProvider apiKey={apiKey}>
        <MapCanvas {...props} />
      </APIProvider>
    </div>
  );
}

function MapCanvas({
  zones,
  draft,
  selectedId,
  onPick,
  onSelect,
  dropping = false,
}: ZoneMapProps) {
  const selected = zones.find((zone) => zone.id === selectedId) ?? null;

  return (
    <Map
      className="h-full w-full"
      mapId={MAP_ID}
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      gestureHandling="cooperative"
      restriction={RESTRICTION}
      clickableIcons={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      draggableCursor={dropping ? "crosshair" : undefined}
      onClick={
        onPick && dropping
          ? (event) => {
              const point = event.detail.latLng;
              if (point) onPick(point.lat, point.lng);
            }
          : undefined
      }
    >
      <ViewportSync
        zones={zones}
        draft={draft}
        selectedLat={selected?.lat ?? null}
        selectedLng={selected?.lng ?? null}
      />

      {zones.map((zone) => (
        <ZoneCircle
          key={zone.id}
          lat={zone.lat}
          lng={zone.lng}
          radiusM={zone.radiusM}
          tone={zone.id === selectedId ? "selected" : "zone"}
          onClick={dropping ? undefined : () => onSelect(zone.id)}
        />
      ))}

      {draft && (
        <>
          <ZoneCircle
            lat={draft.lat}
            lng={draft.lng}
            radiusM={draft.radiusM}
            tone="draft"
          />
          <AdvancedMarker
            position={{ lat: draft.lat, lng: draft.lng }}
            title="Zone centre"
            draggable={!!onPick}
            onDragEnd={
              onPick
                ? (event) => {
                    if (event.latLng) {
                      onPick(event.latLng.lat(), event.latLng.lng());
                    }
                  }
                : undefined
            }
          />
        </>
      )}
    </Map>
  );
}

interface ZoneCircleProps {
  lat: number;
  lng: number;
  radiusM: number;
  tone: CircleTone;
  onClick?: () => void;
}

/** vis.gl has no Circle component, so this wraps the Maps Circle directly. */
function ZoneCircle({ lat, lng, radiusM, tone, onClick }: ZoneCircleProps) {
  const map = useMap();
  const maps = useMapsLibrary("maps");
  const circleRef = useRef<CircleHandle | null>(null);
  const onClickRef = useRef(onClick);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!map || !maps) return;
    const circle: CircleHandle = new maps.Circle({
      map,
      clickable: !!onClick,
      ...CIRCLE_STYLE[tone],
      center: { lat, lng },
      radius: radiusM,
    });
    const listener = circle.addListener("click", () => {
      onClickRef.current?.();
    });
    circleRef.current = circle;
    return () => {
      listener.remove();
      circle.setMap(null);
      circleRef.current = null;
    };
    // Created once per map; geometry and style are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, maps]);

  useEffect(() => {
    circleRef.current?.setOptions({
      ...CIRCLE_STYLE[tone],
      clickable: !!onClick,
      center: { lat, lng },
      radius: radiusM,
    });
  }, [lat, lng, radiusM, tone, onClick]);

  return null;
}

/** Literal bounds around each zone's circle, so no Maps library class is needed to fit. */
function zonesBounds(zones: TutorZone[]) {
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const zone of zones) {
    const dLat = zone.radiusM / METRES_PER_DEGREE;
    const dLng =
      zone.radiusM / (METRES_PER_DEGREE * Math.cos((zone.lat * Math.PI) / 180));
    north = Math.max(north, zone.lat + dLat);
    south = Math.min(south, zone.lat - dLat);
    east = Math.max(east, zone.lng + dLng);
    west = Math.min(west, zone.lng - dLng);
  }
  return { north, south, east, west };
}

interface ViewportSyncProps {
  zones: TutorZone[];
  draft: ZoneMapDraft | null;
  selectedLat: number | null;
  selectedLng: number | null;
}

/** Fits the view to the zones, or follows the pin while one is being placed. */
function ViewportSync({
  zones,
  draft,
  selectedLat,
  selectedLng,
}: ViewportSyncProps) {
  const map = useMap();
  const hasDraft = draft !== null;
  const draftLat = draft?.lat ?? null;
  const draftLng = draft?.lng ?? null;

  useEffect(() => {
    if (!map || hasDraft) return;
    if (zones.length === 0) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
      return;
    }
    map.fitBounds(zonesBounds(zones), FIT_PADDING);
  }, [map, hasDraft, zones]);

  useEffect(() => {
    if (!map || draftLat === null || draftLng === null) return;
    const point = { lat: draftLat, lng: draftLng };
    const view = map.getBounds();
    if (!view || !view.contains(point)) map.panTo(point);
  }, [map, draftLat, draftLng]);

  useEffect(() => {
    if (!map || selectedLat === null || selectedLng === null) return;
    const point = { lat: selectedLat, lng: selectedLng };
    const view = map.getBounds();
    if (!view || !view.contains(point)) map.panTo(point);
  }, [map, selectedLat, selectedLng]);

  return null;
}
