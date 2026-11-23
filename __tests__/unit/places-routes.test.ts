import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSession } from "@/lib/auth.server";

vi.mock("@/lib/auth.server", () => ({ getSession: vi.fn() }));

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
const { POST: reversePost } = await import("@/app/api/places/reverse/route");

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

describe("POST /api/places/reverse", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      id: "u1",
      email: "a@example.com",
      name: "A",
      role: "STUDENT",
    });
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.mocked(getSession).mockReset();
  });

  const okGeocode = {
    status: "OK",
    results: [
      {
        formatted_address: "Mirpur 10, Dhaka, Bangladesh",
        place_id: "ChIJ-pin",
        address_components: [
          {
            long_name: "Dhaka",
            short_name: "Dhaka",
            types: ["administrative_area_level_2", "political"],
          },
          {
            long_name: "Bangladesh",
            short_name: "BD",
            types: ["country", "political"],
          },
        ],
      },
    ],
  };

  it("returns 401 without a signed-in session", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "Sign in to use the map." });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 500 with the generic message when the API key is missing", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      message: "Couldn't look up that spot. Try again.",
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await reversePost(
      new Request("http://localhost/api/places/reverse", {
        method: "POST",
        body: "not json",
      }) as never,
    );
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing lng", { lat: 23.7465 }],
    ["a string lat", { lat: "23.7", lng: 90.4 }],
    ["a null lat (non-finite)", { lat: null, lng: 90.4 }],
    ["a point outside the box", { lat: 30, lng: 90.4 }],
    ["a longitude outside the box", { lat: 23.7, lng: 80 }],
  ])("returns 400 for %s", async (_, body) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await reversePost(jsonRequest(body) as never);
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 422 when Google finds no address", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ZERO_RESULTS", results: [] }), {
        status: 200,
      }),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ message: "No address found here." });
  });

  it("rejects a point Google places outside Bangladesh with 422", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "Kolkata, India",
              place_id: "ChIJ-in",
              address_components: [
                { long_name: "India", short_name: "IN", types: ["country"] },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.5, lng: 90.4 }) as never,
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      message: "Pick a location in Bangladesh.",
    });
  });

  it("returns the address, place id and district, and never the coordinates", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(okGeocode), { status: 200 }),
      );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      formattedAddress: "Mirpur 10, Dhaka, Bangladesh",
      placeId: "ChIJ-pin",
      district: "Dhaka",
    });
    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(
      "https://maps.googleapis.com/maps/api/geocode/json",
    );
    expect(url.searchParams.get("latlng")).toBe("23.7465,90.376");
    expect(url.searchParams.get("key")).toBe("test-key");
    expect(url.searchParams.get("region")).toBe("bd");
    expect(url.searchParams.get("language")).toBe("en");
  });

  it("skips a plus-code result and takes the address from the next one", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "XXXX+XX Dhaka, Bangladesh",
              place_id: "ChIJ-plus",
              types: ["plus_code"],
              address_components: [
                {
                  long_name: "Bangladesh",
                  short_name: "BD",
                  types: ["country"],
                },
              ],
            },
            {
              formatted_address: "Road 5, Dhanmondi, Dhaka, Bangladesh",
              place_id: "ChIJ-road",
              types: ["street_address"],
              address_components: [
                {
                  long_name: "Bangladesh",
                  short_name: "BD",
                  types: ["country"],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(await res.json()).toEqual({
      formattedAddress: "Road 5, Dhanmondi, Dhaka, Bangladesh",
      placeId: "ChIJ-road",
      district: null,
    });
  });

  it("strips a plus code Google puts in front of the address", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "Q963+JC3, Road No. 1, Dhaka, Bangladesh",
              place_id: "ChIJ-coded",
              types: ["establishment", "point_of_interest"],
              address_components: [
                {
                  long_name: "Bangladesh",
                  short_name: "BD",
                  types: ["country"],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(await res.json()).toMatchObject({
      formattedAddress: "Road No. 1, Dhaka, Bangladesh",
      placeId: "ChIJ-coded",
    });
  });

  it("builds the address from its parts: street, sub-area, area, city", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address:
                "Q963+JC3, 8 Road No. 1, Dhaka 1205, Bangladesh",
              place_id: "ChIJ-house",
              types: ["street_address"],
              address_components: [
                {
                  long_name: "Q963+JC3",
                  short_name: "Q963+JC3",
                  types: ["plus_code"],
                },
                { long_name: "8", short_name: "8", types: ["street_number"] },
                {
                  long_name: "Road No. 1",
                  short_name: "Road No. 1",
                  types: ["route"],
                },
                {
                  long_name: "Dhaka",
                  short_name: "Dhaka",
                  types: ["locality", "political"],
                },
                {
                  long_name: "Bangladesh",
                  short_name: "BD",
                  types: ["country"],
                },
              ],
            },
            {
              formatted_address: "Kalabagan, Dhanmondi, Dhaka, Bangladesh",
              place_id: "ChIJ-area",
              types: ["political", "sublocality"],
              address_components: [
                {
                  long_name: "Kalabagan",
                  short_name: "Kalabagan",
                  types: ["political", "sublocality", "sublocality_level_2"],
                },
                {
                  long_name: "Dhanmondi",
                  short_name: "Dhanmondi",
                  types: ["political", "sublocality", "sublocality_level_1"],
                },
                {
                  long_name: "Dhaka District",
                  short_name: "Dhaka District",
                  types: ["administrative_area_level_2", "political"],
                },
                {
                  long_name: "Bangladesh",
                  short_name: "BD",
                  types: ["country"],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(await res.json()).toEqual({
      formattedAddress: "8 Road No. 1, Kalabagan, Dhanmondi, Dhaka, Bangladesh",
      placeId: "ChIJ-house",
      district: "Dhaka District",
    });
  });

  it("leaves out parts Google doesn't have", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "Q963+JC3, Road No. 1, Dhaka, Bangladesh",
              place_id: "ChIJ-road",
              types: ["route"],
              address_components: [
                {
                  long_name: "Road No. 1",
                  short_name: "Road No. 1",
                  types: ["route"],
                },
                {
                  long_name: "Dhaka",
                  short_name: "Dhaka",
                  types: ["locality"],
                },
                {
                  long_name: "Bangladesh",
                  short_name: "BD",
                  types: ["country"],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(await res.json()).toMatchObject({
      formattedAddress: "Road No. 1, Dhaka, Bangladesh",
    });
  });

  it("takes the district from a later result when the first has none", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "Road 5, Bangladesh",
              place_id: "ChIJ-first",
              address_components: [
                {
                  long_name: "Bangladesh",
                  short_name: "BD",
                  types: ["country"],
                },
              ],
            },
            {
              formatted_address: "Dhaka, Bangladesh",
              place_id: "ChIJ-second",
              address_components: [
                {
                  long_name: "Bangladesh",
                  short_name: "BD",
                  types: ["country"],
                },
                {
                  long_name: "Gazipur",
                  short_name: "Gazipur",
                  types: ["administrative_area_level_2", "political"],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(await res.json()).toEqual({
      formattedAddress: "Road 5, Bangladesh",
      placeId: "ChIJ-first",
      district: "Gazipur",
    });
  });

  it("returns a null district when no district component exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "Bangladesh",
              place_id: "ChIJ-bd",
              address_components: [
                {
                  long_name: "Bangladesh",
                  short_name: "BD",
                  types: ["country"],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7, lng: 90.4 }) as never,
    );
    expect(await res.json()).toMatchObject({ district: null });
  });

  it("returns 502 with the generic message and never Google's error text", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "REQUEST_DENIED",
          error_message: "The provided API key is invalid.",
          results: [],
        }),
        { status: 403 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      message: "Couldn't look up that spot. Try again.",
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      "REQUEST_DENIED",
      "The provided API key is invalid.",
    );
  });

  it("returns 502 when Google cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("down"));
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(res.status).toBe(502);
  });

  const roadGeocode = (components: unknown[] = [], types = ["route"]) => ({
    status: "OK",
    results: [
      {
        formatted_address: "Road 2, Dhaka, Bangladesh",
        place_id: "ChIJ-road2",
        types,
        address_components: [
          { long_name: "Road 2", short_name: "Road 2", types: ["route"] },
          { long_name: "Dhaka", short_name: "Dhaka", types: ["locality"] },
          { long_name: "Bangladesh", short_name: "BD", types: ["country"] },
          ...components,
        ],
      },
    ],
  });

  it("names a clicked POI from Places and uses the POI's place id", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(roadGeocode()), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ displayName: { text: "Dhaka College" } }),
          { status: 200 },
        ),
      );
    const res = await reversePost(
      jsonRequest({
        lat: 23.7465,
        lng: 90.376,
        placeId: "  ChIJ-poi  ",
      }) as never,
    );
    expect(await res.json()).toEqual({
      formattedAddress: "Dhaka College, Road 2, Dhaka, Bangladesh",
      placeId: "ChIJ-poi",
      district: null,
    });
    const placesCall = fetchSpy.mock.calls[1];
    expect(String(placesCall[0])).toBe(
      "https://places.googleapis.com/v1/places/ChIJ-poi?key=test-key",
    );
    expect(placesCall[1]?.headers).toEqual({
      "X-Goog-FieldMask": "displayName",
    });
  });

  it("still returns the address when the Places name lookup fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(roadGeocode()), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Denied" } }), {
          status: 403,
        }),
      );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376, placeId: "ChIJ-poi" }) as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      formattedAddress: "Road 2, Dhaka, Bangladesh",
      placeId: "ChIJ-poi",
      district: null,
    });
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), 403, "Denied");
  });

  it("prefixes a premise name on a plain click without another Places call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          roadGeocode(
            [
              {
                long_name: "Sunrise Tower",
                short_name: "Sunrise Tower",
                types: ["premise"],
              },
            ],
            ["premise"],
          ),
        ),
        { status: 200 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(await res.json()).toEqual({
      formattedAddress: "Sunrise Tower, Road 2, Dhaka, Bangladesh",
      placeId: "ChIJ-road2",
      district: null,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not repeat the street as the name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "8 Road No. 1, Dhaka, Bangladesh",
              place_id: "ChIJ-house",
              types: ["premise"],
              address_components: [
                { long_name: "8", short_name: "8", types: ["street_number"] },
                {
                  long_name: "Road No. 1",
                  short_name: "Road No. 1",
                  types: ["route"],
                },
                {
                  long_name: "8 Road No. 1",
                  short_name: "8 Road No. 1",
                  types: ["premise"],
                },
                {
                  long_name: "Dhaka",
                  short_name: "Dhaka",
                  types: ["locality"],
                },
                {
                  long_name: "Bangladesh",
                  short_name: "BD",
                  types: ["country"],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(await res.json()).toMatchObject({
      formattedAddress: "8 Road No. 1, Dhaka, Bangladesh",
    });
  });

  it("does not prefix an establishment name on a plain street click", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          roadGeocode(
            [
              {
                long_name: "Dhaka College",
                short_name: "Dhaka College",
                types: ["establishment", "point_of_interest"],
              },
            ],
            ["street_address"],
          ),
        ),
        { status: 200 },
      ),
    );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376 }) as never,
    );
    expect(await res.json()).toMatchObject({
      formattedAddress: "Road 2, Dhaka, Bangladesh",
    });
  });

  it("reverse geocodes a POI by its place id, not the coordinates", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(roadGeocode()), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ displayName: { text: "Dhaka College" } }),
          { status: 200 },
        ),
      );
    await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376, placeId: "ChIJ-poi" }) as never,
    );
    const geocodeUrl = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(geocodeUrl.searchParams.get("place_id")).toBe("ChIJ-poi");
    expect(geocodeUrl.searchParams.has("latlng")).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a space inside", "ChIJ poi"],
    ["a slash", "ChIJ/../x"],
    ["a query character", "ChIJ?key=x"],
    ["more than 300 characters", "a".repeat(301)],
  ])("ignores a placeId with %s", async (_, placeId) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(roadGeocode()), { status: 200 }),
      );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376, placeId }) as never,
    );
    expect(await res.json()).toMatchObject({ placeId: "ChIJ-road2" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("latlng=");
  });

  it("ignores a placeId that is not a string", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(roadGeocode()), { status: 200 }),
      );
    const res = await reversePost(
      jsonRequest({ lat: 23.7465, lng: 90.376, placeId: 42 }) as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ placeId: "ChIJ-road2" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
