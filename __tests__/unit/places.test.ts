import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchPlacePredictions,
  fetchPlaceDetails,
  fetchReverseGeocode,
  makeSessionToken,
  PlaceLookupError,
  pickedPlaceLabel,
} from "@/lib/places";

describe("pickedPlaceLabel", () => {
  const empty = {
    placeId: "ChIJ1",
    description: "",
    mainText: "",
    secondaryText: "",
  };

  it("uses the suggestion's description, trimmed", () => {
    expect(
      pickedPlaceLabel(
        {
          ...empty,
          description: "  Dhanmondi, Dhaka  ",
          mainText: "Dhanmondi",
          secondaryText: "Dhaka",
        },
        "Formatted",
      ),
    ).toBe("Dhanmondi, Dhaka");
  });

  it("joins the main and secondary text when the description is empty", () => {
    expect(
      pickedPlaceLabel(
        { ...empty, mainText: " Dhanmondi ", secondaryText: "Dhaka" },
        "Formatted",
      ),
    ).toBe("Dhanmondi, Dhaka");
  });

  it("falls back to the formatted address when there is no suggestion text", () => {
    expect(pickedPlaceLabel(empty, "  Dhanmondi, Dhaka, Bangladesh ")).toBe(
      "Dhanmondi, Dhaka, Bangladesh",
    );
  });

  it("caps the label at 500 characters", () => {
    expect(
      pickedPlaceLabel({ ...empty, description: "a".repeat(600) }, ""),
    ).toHaveLength(500);
  });
});

describe("makeSessionToken", () => {
  it("returns a uuid-v4-shaped string", () => {
    const token = makeSessionToken();
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("returns a new token each time", () => {
    expect(makeSessionToken()).not.toBe(makeSessionToken());
  });
});

describe("fetchPlacePredictions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts input and sessionToken to the autocomplete proxy", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ predictions: [] }), { status: 200 }),
      );
    await fetchPlacePredictions("Dhanmondi", "token-1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/places/autocomplete",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "Dhanmondi", sessionToken: "token-1" }),
      }),
    );
  });

  it("trims the input", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ predictions: [] }), { status: 200 }),
      );
    await fetchPlacePredictions("  Dhanmondi  ", "token-1");
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      input: "Dhanmondi",
      sessionToken: "token-1",
    });
  });

  it("returns predictions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          predictions: [
            {
              placeId: "ChIJ123",
              description: "Dhanmondi, Dhaka",
              mainText: "Dhanmondi",
              secondaryText: "Dhaka",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await fetchPlacePredictions("Dhan", "token-1");
    expect(result).toHaveLength(1);
    expect(result[0].placeId).toBe("ChIJ123");
  });

  it("throws on error response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Bad request" }), { status: 400 }),
    );
    await expect(fetchPlacePredictions("Dhan", "token-1")).rejects.toThrow(
      "Bad request",
    );
  });
});

describe("fetchPlaceDetails", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts placeId and sessionToken to the details proxy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          formattedAddress: "Dhaka",
          location: { latitude: 1, longitude: 2 },
        }),
        { status: 200 },
      ),
    );
    await fetchPlaceDetails("ChIJ123", "token-1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/places/details",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ placeId: "ChIJ123", sessionToken: "token-1" }),
      }),
    );
  });

  it("returns address, coordinates and district", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          formattedAddress: "Dhaka",
          location: { latitude: 1, longitude: 2 },
          district: "Dhaka",
        }),
        { status: 200 },
      ),
    );
    const result = await fetchPlaceDetails("ChIJ123", "token-1");
    expect(result).toEqual({
      formattedAddress: "Dhaka",
      location: { latitude: 1, longitude: 2 },
      district: "Dhaka",
    });
  });

  it("returns a null district when Google has none", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          formattedAddress: "Dhaka",
          location: { latitude: 1, longitude: 2 },
          district: null,
        }),
        { status: 200 },
      ),
    );
    const result = await fetchPlaceDetails("ChIJ123", "token-1");
    expect(result.district).toBeNull();
  });

  it("throws the proxy's message for a non-Bangladesh place", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: "Pick a location in Bangladesh." }),
        {
          status: 422,
        },
      ),
    );
    await expect(fetchPlaceDetails("ChIJ123", "token-1")).rejects.toThrow(
      "Pick a location in Bangladesh.",
    );
  });
});

describe("fetchReverseGeocode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts lat and lng to the reverse proxy and returns the address", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          formattedAddress: "Dhaka",
          placeId: "ChIJ-pin",
          district: "Dhaka",
        }),
        { status: 200 },
      ),
    );
    const result = await fetchReverseGeocode(23.7465, 90.376);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/places/reverse",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ lat: 23.7465, lng: 90.376 }),
      }),
    );
    expect(result).toEqual({
      formattedAddress: "Dhaka",
      placeId: "ChIJ-pin",
      district: "Dhaka",
    });
  });

  it("posts the placeId of a clicked POI when there is one", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          formattedAddress: "Dhaka College, Dhaka",
          placeId: "ChIJ-poi",
          district: "Dhaka",
        }),
        { status: 200 },
      ),
    );
    await fetchReverseGeocode(23.7465, 90.376, "ChIJ-poi");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/places/reverse",
      expect.objectContaining({
        body: JSON.stringify({
          lat: 23.7465,
          lng: 90.376,
          placeId: "ChIJ-poi",
        }),
      }),
    );
  });

  it("throws the proxy's message and status on a 422", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "No address found here." }), {
        status: 422,
      }),
    );
    const err = await fetchReverseGeocode(23.7, 90.4).catch((e) => e);
    expect(err).toBeInstanceOf(PlaceLookupError);
    expect(err).toMatchObject({
      message: "No address found here.",
      status: 422,
    });
  });

  it("throws the fallback message on a 502, whatever the body says", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: "Couldn't look up that spot. Try again." }),
        {
          status: 502,
        },
      ),
    );
    const err = await fetchReverseGeocode(23.7, 90.4).catch((e) => e);
    expect(err).toMatchObject({
      message: "Couldn't look up that spot. Try again.",
      status: 502,
    });
  });

  it("throws the fallback message when the error body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html>bad gateway</html>", { status: 502 }),
    );
    const err = await fetchReverseGeocode(23.7, 90.4).catch((e) => e);
    expect(err).toMatchObject({
      message: "Couldn't find an address there.",
      status: 502,
    });
  });
});
