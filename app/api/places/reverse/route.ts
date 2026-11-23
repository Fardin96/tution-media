import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";

// Same box as BD_BOUNDS in lib/tutor-zones.ts (that module is client-side, so it isn't imported here).
const BD_BOUNDS = { south: 20.5, north: 26.7, west: 88, east: 92.7 };

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const PLACES_URL = "https://places.googleapis.com/v1/places";
// Google's own error text stays in the server log; the client only ever sees this.
const GENERIC_ERROR = "Couldn't look up that spot. Try again.";

interface GeocodeResult {
  formatted_address?: string;
  place_id?: string;
  types?: string[];
  address_components?: {
    long_name?: string;
    short_name?: string;
    types?: string[];
  }[];
}

// A leading Open Location Code ("Q963+JC3, " or "Q963+JC3 "), which Google puts in front of many Bangladesh addresses.
const PLUS_CODE_PREFIX =
  /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]*(?:,\s*|\s+)/i;

function stripPlusCode(address: string): string {
  return address.replace(PLUS_CODE_PREFIX, "").trim();
}

// A whole plus code, used as a place name: Google sometimes returns one where a name should be.
const PLUS_CODE_NAME =
  /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]*$/i;
// A Place ID from the map's click: letters, digits, "_" and "-" only.
const PLACE_ID = /^[A-Za-z0-9_-]{1,300}$/;

type Component = NonNullable<GeocodeResult["address_components"]>[number];

/**
 * "8 Road No. 1, <sub-area>, <area>, Dhaka, Bangladesh", built from the parts so a plus code never shows.
 * The street comes from the chosen result only (another result can be a different road); the areas and
 * city can come from any result, since they all describe the same point. Null when there is no street or area.
 */
function buildAddress(
  first: GeocodeResult,
  results: GeocodeResult[],
): string | null {
  const own = first.address_components ?? [];
  const all = [own, ...results.map((r) => r.address_components ?? [])].flat();
  const name = (list: Component[], type: string) =>
    list.find((c) => c.types?.includes(type))?.long_name?.trim() || null;

  const street = [name(own, "street_number"), name(own, "route")]
    .filter(Boolean)
    .join(" ");
  const subArea = name(all, "sublocality_level_2") ?? name(all, "neighborhood");
  const area = name(all, "sublocality_level_1") ?? name(all, "sublocality");
  const city =
    name(all, "locality") ??
    name(all, "administrative_area_level_2")?.replace(/\s+district$/i, "") ??
    null;
  // Only the city is less than Google's own line says, so that falls back to it.
  if (!street && !subArea && !area) return null;

  const parts: string[] = [];
  for (const part of [street, subArea, area, city, "Bangladesh"]) {
    if (part && !parts.some((p) => p.toLowerCase() === part.toLowerCase()))
      parts.push(part);
  }
  return parts.join(", ");
}

/** The name of the landmark the user clicked, from its Place ID. Null on any failure: the address still works without it. */
async function poiName(
  apiKey: string,
  placeId: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${PLACES_URL}/${encodeURIComponent(placeId)}?key=${apiKey}`,
      { method: "GET", headers: { "X-Goog-FieldMask": "displayName" } },
    );
    const data = (await res.json()) as {
      displayName?: { text?: string };
      error?: { message?: string };
    };
    if (!res.ok) {
      console.error(
        "Google Places name lookup failed:",
        res.status,
        data.error?.message ?? "",
      );
      return null;
    }
    return data.displayName?.text?.trim() || null;
  } catch (err) {
    console.error("Google Places name lookup request failed:", err);
    return null;
  }
}

/** The building's name on a plain click: only when the chosen result is itself a premise. */
function premiseName(first: GeocodeResult): string | null {
  if (!first.types?.includes("premise")) return null;
  const found = (first.address_components ?? []).find((c) =>
    c.types?.includes("premise"),
  );
  return found?.long_name?.trim() || null;
}

/** "Dhaka College, <address>", unless there is no usable name or the address already starts with it. */
function withName(name: string | null, address: string): string {
  if (!name || PLUS_CODE_NAME.test(name)) return address;
  const streetPart = address.split(",")[0].trim().toLowerCase();
  if (name.toLowerCase() === streetPart) return address;
  return `${name}, ${address}`.slice(0, 500);
}

// shortcut: the session cookie is unsigned, so this check only stops casual use; add a rate limit on /api/places/* before deploy.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { message: "Sign in to use the map." },
      { status: 401 },
    );
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY is not set; reverse geocoding is off.");
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as {
    lat?: unknown;
    lng?: unknown;
    placeId?: unknown;
  } | null;
  const lat = body?.lat;
  const lng = body?.lng;
  // Set when the click landed on a POI icon; anything else is ignored.
  const clickedId =
    typeof body?.placeId === "string" ? body.placeId.trim() : "";
  const requestedPlaceId = PLACE_ID.test(clickedId) ? clickedId : "";

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < BD_BOUNDS.south ||
    lat > BD_BOUNDS.north ||
    lng < BD_BOUNDS.west ||
    lng > BD_BOUNDS.east
  ) {
    return NextResponse.json(
      { message: "lat and lng must be a point inside Bangladesh." },
      { status: 400 },
    );
  }

  try {
    const url = new URL(GEOCODE_URL);
    // A POI click geocodes its own Place ID, which is more accurate than the click's coordinates.
    if (requestedPlaceId) url.searchParams.set("place_id", requestedPlaceId);
    else url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("region", "bd");
    url.searchParams.set("language", "en");

    const res = await fetch(url.toString(), { method: "GET" });
    const data = (await res.json()) as {
      status?: string;
      error_message?: string;
      results?: GeocodeResult[];
    };

    if (data.status === "ZERO_RESULTS") {
      return NextResponse.json(
        { message: "No address found here." },
        { status: 422 },
      );
    }
    if (data.status !== "OK") {
      console.error(
        "Google reverse geocode failed:",
        data.status ?? res.status,
        data.error_message ?? "",
      );
      return NextResponse.json({ message: GENERIC_ERROR }, { status: 502 });
    }

    const results = data.results ?? [];
    // Google lists the most specific result first; a plus-code result is a grid reference, not an address.
    const first =
      results.find((r) => !r.types?.includes("plus_code")) ?? results[0];
    const formattedAddress = first
      ? (buildAddress(first, results) ??
        stripPlusCode(first.formatted_address ?? ""))
      : "";
    if (!formattedAddress || !first?.place_id) {
      return NextResponse.json(
        { message: "No address found here." },
        { status: 422 },
      );
    }

    const components = first.address_components ?? [];
    const country = components.find((c) => c.types?.includes("country"));
    if (country?.short_name !== "BD") {
      return NextResponse.json(
        { message: "Pick a location in Bangladesh." },
        { status: 422 },
      );
    }

    const name = requestedPlaceId
      ? await poiName(apiKey, requestedPlaceId)
      : premiseName(first);

    // Any result can carry the district, so the first one that has it wins.
    const district =
      results
        .flatMap((r) => r.address_components ?? [])
        .find((c) => c.types?.includes("administrative_area_level_2"))
        ?.long_name ?? null;

    return NextResponse.json({
      formattedAddress: withName(name, formattedAddress),
      placeId: requestedPlaceId || first.place_id,
      district,
    });
  } catch (err) {
    console.error("Google reverse geocode request failed:", err);
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 502 });
  }
}
