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
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
  });

  it("returns 500 when the API key is missing", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
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

  it("restricts suggestions to Bangladesh", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ suggestions: [] }), { status: 200 }),
      );
    await autocompletePost(
      jsonRequest({ input: "Dhan", sessionToken: "t1" }) as never,
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({
      includedRegionCodes: ["bd"],
    });
  });
});

describe("POST /api/places/details", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
  });

  it("returns 500 when the API key is missing", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const res = await detailsPost(
      jsonRequest({ placeId: "ChIJ123", sessionToken: "t1" }) as never,
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 when placeId or sessionToken is missing", async () => {
    const res = await detailsPost(jsonRequest({ placeId: "ChIJ123" }) as never);
    expect(res.status).toBe(400);
  });

  it("proxies to Google Places and returns formattedAddress, location and district", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          formattedAddress: "Dhanmondi, Dhaka",
          location: { latitude: 23.7465, longitude: 90.376 },
          addressComponents: [
            {
              longText: "Dhaka",
              shortText: "Dhaka",
              types: ["administrative_area_level_2", "political"],
            },
            { longText: "Bangladesh", shortText: "BD", types: ["country"] },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await detailsPost(
      jsonRequest({ placeId: "ChIJ123", sessionToken: "t1" }) as never,
    );
    expect(res.status).toBe(200);
    expect(fetchSpy.mock.calls[0][1]?.headers).toEqual({
      "X-Goog-FieldMask": "location,formattedAddress,addressComponents",
    });
    expect(await res.json()).toEqual({
      formattedAddress: "Dhanmondi, Dhaka",
      location: { latitude: 23.7465, longitude: 90.376 },
      district: "Dhaka",
    });
  });

  it("returns a null district when no district component exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          formattedAddress: "Bangladesh",
          location: { latitude: 23.7, longitude: 90.4 },
          addressComponents: [
            { longText: "Bangladesh", shortText: "BD", types: ["country"] },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await detailsPost(
      jsonRequest({ placeId: "ChIJ123", sessionToken: "t1" }) as never,
    );
    expect(await res.json()).toMatchObject({ district: null });
  });

  it("rejects a place outside Bangladesh with 422", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          formattedAddress: "Kolkata, India",
          location: { latitude: 22.5, longitude: 88.3 },
          addressComponents: [
            { longText: "India", shortText: "IN", types: ["country"] },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await detailsPost(
      jsonRequest({ placeId: "ChIJ999", sessionToken: "t1" }) as never,
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      message: "Pick a location in Bangladesh.",
    });
  });
});
