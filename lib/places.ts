export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  district: string | null;
}

/**
 * The text the user picked. Google's formatted address can differ from it, so it never replaces
 * what the user chose: the suggestion's text wins, and the formatted address is only a last resort.
 */
export function pickedPlaceLabel(
  prediction: PlacePrediction,
  formatted: string,
): string {
  return (
    prediction.description.trim() ||
    [prediction.mainText, prediction.secondaryText]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ") ||
    formatted.trim()
  ).slice(0, 500);
}

/** Insecure-but-unique enough for a single autocomplete session. */
export function makeSessionToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function fetchPlacePredictions(
  input: string,
  sessionToken: string,
): Promise<PlacePrediction[]> {
  const res = await fetch("/api/places/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: input.trim(), sessionToken }),
  });
  const body = (await res.json()) as {
    predictions?: PlacePrediction[];
    message?: string;
  };
  if (!res.ok)
    throw new Error(body.message || `Autocomplete failed (${res.status})`);
  return body.predictions ?? [];
}

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails> {
  const res = await fetch("/api/places/details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, sessionToken }),
  });
  const body = (await res.json()) as PlaceDetails & { message?: string };
  if (!res.ok)
    throw new Error(body.message || `Place details failed (${res.status})`);
  return body;
}
