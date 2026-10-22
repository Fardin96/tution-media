import { NextRequest, NextResponse } from "next/server";

function detailsUrl(apiKey: string, placeId: string) {
  const encoded = encodeURIComponent(placeId);
  return `https://places.googleapis.com/v1/places/${encoded}?key=${apiKey}`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: "Places API key is not configured." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    placeId?: unknown;
    sessionToken?: unknown;
  };
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  const sessionToken =
    typeof body.sessionToken === "string" ? body.sessionToken : "";

  if (!placeId || !sessionToken) {
    return NextResponse.json(
      { message: "placeId and sessionToken are required." },
      { status: 400 },
    );
  }

  try {
    const url = new URL(detailsUrl(apiKey, placeId));
    url.searchParams.set("sessionToken", sessionToken);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Goog-FieldMask": "location,formattedAddress",
      },
    });

    const data = (await res.json()) as {
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      error?: { message?: string };
    };

    if (!res.ok) {
      return NextResponse.json(
        {
          message: data.error?.message || `Google Places error (${res.status})`,
        },
        { status: res.status === 403 ? 500 : res.status },
      );
    }

    if (!data.formattedAddress || !data.location) {
      return NextResponse.json(
        { message: "Place details are incomplete." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      formattedAddress: data.formattedAddress,
      location: {
        latitude: data.location.latitude ?? 0,
        longitude: data.location.longitude ?? 0,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Couldn't reach Google Places." },
      { status: 502 },
    );
  }
}
