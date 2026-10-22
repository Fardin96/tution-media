import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextRequest: class extends Request {},
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), init),
  },
}));

const { POST: autocompletePost } =
  await import("@/app/api/places/autocomplete/route");
const { POST: detailsPost } = await import("@/app/api/places/details/route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/places", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/places/autocomplete", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GOOGLE_PLACES_KEY = "test-key";
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it("returns 500 when the API key is missing", async () => {
    delete process.env.GOOGLE_PLACES_KEY;
    const res = await autocompletePost(
      jsonRequest({ input: "Dhan", sessionToken: "t1" }) as never,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      message: "Places API key is not configured.",
    });
  });

  it("returns 400 when input or sessionToken is missing", async () => {
    const res = await autocompletePost(jsonRequest({ input: "Dhan" }) as never);
    expect(res.status).toBe(400);
  });

  it("proxies to Google Places and returns predictions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              placePrediction: {
                placeId: "ChIJ123",
                text: { text: "Dhanmondi, Dhaka" },
                structuredFormat: {
                  mainText: { text: "Dhanmondi" },
                  secondaryText: { text: "Dhaka" },
                },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await autocompletePost(
      jsonRequest({ input: "Dhan", sessionToken: "t1" }) as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      predictions: [
        {
          placeId: "ChIJ123",
          description: "Dhanmondi, Dhaka",
          mainText: "Dhanmondi",
          secondaryText: "Dhaka",
        },
      ],
    });
  });

  it("masks 403 as 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Denied" } }), {
        status: 403,
      }),
    );
    const res = await autocompletePost(
      jsonRequest({ input: "Dhan", sessionToken: "t1" }) as never,
    );
    expect(res.status).toBe(500);
  });
});

describe("POST /api/places/details", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GOOGLE_PLACES_KEY = "test-key";
  });

  it("returns 500 when the API key is missing", async () => {
    delete process.env.GOOGLE_PLACES_KEY;
    const res = await detailsPost(
      jsonRequest({ placeId: "ChIJ123", sessionToken: "t1" }) as never,
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 when placeId or sessionToken is missing", async () => {
    const res = await detailsPost(jsonRequest({ placeId: "ChIJ123" }) as never);
    expect(res.status).toBe(400);
  });

  it("proxies to Google Places and returns formattedAddress and location", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          formattedAddress: "Dhanmondi, Dhaka",
          location: { latitude: 23.7465, longitude: 90.376 },
        }),
        { status: 200 },
      ),
    );
    const res = await detailsPost(
      jsonRequest({ placeId: "ChIJ123", sessionToken: "t1" }) as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      formattedAddress: "Dhanmondi, Dhaka",
      location: { latitude: 23.7465, longitude: 90.376 },
    });
  });
});
