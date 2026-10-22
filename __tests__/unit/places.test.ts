import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchPlacePredictions,
  fetchPlaceDetails,
  makeSessionToken,
} from "@/lib/places";

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

  it("returns address and coordinates", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          formattedAddress: "Dhaka",
          location: { latitude: 1, longitude: 2 },
        }),
        { status: 200 },
      ),
    );
    const result = await fetchPlaceDetails("ChIJ123", "token-1");
    expect(result).toEqual({
      formattedAddress: "Dhaka",
      location: { latitude: 1, longitude: 2 },
    });
  });
});
