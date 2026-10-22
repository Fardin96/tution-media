import { NextRequest, NextResponse } from "next/server";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

export async function POST(request: NextRequest) {
  const apiKey =
    process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: "Places API key is not configured." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    input?: unknown;
    sessionToken?: unknown;
  };
  const input = typeof body.input === "string" ? body.input.trim() : "";
  const sessionToken =
    typeof body.sessionToken === "string" ? body.sessionToken : "";

  if (!input || !sessionToken) {
    return NextResponse.json(
      { message: "input and sessionToken are required." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${AUTOCOMPLETE_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({ input, sessionToken }),
    });

    const data = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }>;
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

    const predictions =
      data.suggestions?.map((s) => {
        const p = s.placePrediction;
        const mainText = p?.structuredFormat?.mainText?.text ?? "";
        const secondaryText = p?.structuredFormat?.secondaryText?.text ?? "";
        return {
          placeId: p?.placeId ?? "",
          description: p?.text?.text ?? "",
          mainText,
          secondaryText,
        };
      }) ?? [];

    return NextResponse.json({ predictions });
  } catch {
    return NextResponse.json(
      { message: "Couldn't reach Google Places." },
      { status: 502 },
    );
  }
}
