import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { parseJson } from "./profile";
import { queryKeys, type ZoneRequestStatus } from "./query-keys";

// Mirrors tuition-api/src/modules/zone/zone.schema.ts.
export const RADIUS_MIN_M = 1000;
export const RADIUS_MAX_M = 5000;
export const RADIUS_STEP_M = 250;
export const DEFAULT_RADIUS_M = 2000;
export const ZONE_LIMIT_MAX = 50;
export const LABEL_MAX = 60;
export const REASON_MIN = 10;
export const REASON_MAX = 500;

// Bangladesh bounding box, the same as the server's zone_in_bd CHECK.
export const BD_BOUNDS = { south: 20.5, north: 26.7, west: 88, east: 92.7 };
// Dhaka, used to centre an empty map.
export const DEFAULT_CENTER = { lat: 23.8103, lng: 90.4125 };

export interface TutorZone {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
  placeId: string | null;
  addressText: string | null;
  requirementIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ZoneLimitRequest {
  id: string;
  requestedLimit: number;
  reason: string;
  status: ZoneRequestStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface ZoneList {
  zones: TutorZone[];
  limit: number;
  used: number;
  pendingRequest: ZoneLimitRequest | null;
}

export interface ZoneDeleteResult {
  id: string;
  affectedRequirements: {
    id: string;
    name: string;
    isDefault: boolean;
    isActive: boolean;
    teachesOnline: boolean;
    remainingZoneCount: number;
  }[];
}

export interface ZoneRequestPage {
  requests: ZoneLimitRequest[];
  nextCursor: string | null;
}

export interface AdminZoneRequest extends ZoneLimitRequest {
  tutor: { id: string; name: string; zoneLimit: number; zonesUsed: number };
}

export interface AdminZoneRequestPage {
  requests: AdminZoneRequest[];
  nextCursor: string | null;
}

export interface ZoneForm {
  label: string;
  lat: number | null;
  lng: number | null;
  radiusM: number;
  placeId: string | null;
  addressText: string | null;
}

export type ZoneFormErrors = Partial<Record<keyof ZoneForm, string>>;

const BASE = "/api/v1/tutors/me/zones";
const REQUESTS = "/api/v1/tutors/me/zone-limit-requests";
const ADMIN_REQUESTS = "/api/v1/admin/zone-limit-requests";

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const tutorZoneApi = {
  list: async () => parseJson<ZoneList>(await api.get(BASE)),
  create: async (body: Record<string, unknown>) =>
    parseJson<TutorZone>(await api.post(BASE, body)),
  update: async (id: string, body: Record<string, unknown>) =>
    parseJson<TutorZone>(await api.patch(`${BASE}/${id}`, body)),
  remove: async (id: string) =>
    parseJson<ZoneDeleteResult>(await api.delete(`${BASE}/${id}`)),
  requestMore: async (body: { requestedLimit: number; reason: string }) =>
    parseJson<ZoneLimitRequest>(await api.post(REQUESTS, body)),
  requests: async (cursor?: string) =>
    parseJson<ZoneRequestPage>(
      await api.get(`${REQUESTS}${query({ cursor })}`),
    ),
};

export const adminZoneRequestApi = {
  list: async (status: ZoneRequestStatus, cursor?: string) =>
    parseJson<AdminZoneRequestPage>(
      await api.get(`${ADMIN_REQUESTS}${query({ status, cursor })}`),
    ),
  decide: async (
    id: string,
    body: {
      decision: "APPROVE" | "DENY";
      approvedLimit?: number;
      note?: string;
    },
  ) =>
    parseJson<AdminZoneRequest>(
      await api.post(`${ADMIN_REQUESTS}/${id}/decide`, body),
    ),
};

export function emptyZoneForm(): ZoneForm {
  return {
    label: "",
    lat: null,
    lng: null,
    radiusM: DEFAULT_RADIUS_M,
    placeId: null,
    addressText: null,
  };
}

export function fromZone(zone: TutorZone): ZoneForm {
  return {
    label: zone.label,
    lat: zone.lat,
    lng: zone.lng,
    radiusM: zone.radiusM,
    placeId: zone.placeId,
    addressText: zone.addressText,
  };
}

export function inBangladesh(lat: number, lng: number): boolean {
  return (
    lat >= BD_BOUNDS.south &&
    lat <= BD_BOUNDS.north &&
    lng >= BD_BOUNDS.west &&
    lng <= BD_BOUNDS.east
  );
}

/** Six decimals is about 10 cm, more than a pin drop can mean. */
export function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function validateZoneForm(form: ZoneForm): ZoneFormErrors {
  const errors: ZoneFormErrors = {};
  const label = form.label.trim();
  if (!label) errors.label = "Give this zone a name.";
  else if (label.length > LABEL_MAX)
    errors.label = `Keep the name under ${LABEL_MAX} characters.`;
  if (form.lat === null || form.lng === null) {
    errors.lat = "Search for a place or drop a pin on the map.";
  } else if (!inBangladesh(form.lat, form.lng)) {
    errors.lat = "Pick a spot inside Bangladesh.";
  }
  if (
    !Number.isInteger(form.radiusM) ||
    form.radiusM < RADIUS_MIN_M ||
    form.radiusM > RADIUS_MAX_M
  ) {
    errors.radiusM = "Pick a radius between 1 and 5 km.";
  }
  return errors;
}

export function toCreateZonePayload(form: ZoneForm): Record<string, unknown> {
  const body: Record<string, unknown> = {
    label: form.label.trim(),
    lat: roundCoord(form.lat ?? 0),
    lng: roundCoord(form.lng ?? 0),
    radiusM: form.radiusM,
  };
  if (form.placeId) body.placeId = form.placeId;
  if (form.addressText?.trim()) body.addressText = form.addressText.trim();
  return body;
}

/** Sends only the fields that changed; lat and lng always travel together. */
export function toZonePatch(
  original: TutorZone,
  form: ZoneForm,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const label = form.label.trim();
  if (label !== original.label) patch.label = label;
  const lat = roundCoord(form.lat ?? original.lat);
  const lng = roundCoord(form.lng ?? original.lng);
  if (lat !== roundCoord(original.lat) || lng !== roundCoord(original.lng)) {
    patch.lat = lat;
    patch.lng = lng;
  }
  if (form.radiusM !== original.radiusM) patch.radiusM = form.radiusM;
  if ((form.placeId ?? null) !== original.placeId)
    patch.placeId = form.placeId ?? null;
  const address = form.addressText?.trim() || null;
  if (address !== original.addressText) patch.addressText = address;
  return patch;
}

export function formatRadius(radiusM: number): string {
  const km = radiusM / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(2).replace(/0$/, "")} km`;
}

export function useTutorZones() {
  return useQuery({
    queryKey: queryKeys.tutor.zones,
    queryFn: tutorZoneApi.list,
    staleTime: 60_000,
  });
}

export function useZoneLimitRequests(enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.tutor.zoneRequests,
    queryFn: ({ pageParam }) => tutorZoneApi.requests(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,
    enabled,
  });
}

export function useAdminZoneRequests(status: ZoneRequestStatus) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.zoneRequests({ status }),
    queryFn: ({ pageParam }) => adminZoneRequestApi.list(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}
