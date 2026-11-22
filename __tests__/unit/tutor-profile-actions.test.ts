import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateTag } from "next/cache";
import {
  refreshMyTutorProfile,
  refreshTutorProfilesAsAdmin,
} from "@/lib/tutor-profile.actions";

vi.mock("next/cache", () => ({ updateTag: vi.fn() }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** The shape GET /api/v1/me returns; `tutorId` null means the account has no tutor profile. */
const meFor = (tutorId: unknown) => ({
  account: {
    id: "9b1f0c1e-5d2a-4f7e-8a3b-2c4d6e8f0a1b",
    role: "TUTOR",
    tutor: tutorId === null ? undefined : { id: tutorId },
  },
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(updateTag).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refreshMyTutorProfile", () => {
  it("refuses a token the API does not accept and leaves the cache alone", async () => {
    fetchMock.mockResolvedValue(json(401, { error: "Unauthorized" }));

    await expect(refreshMyTutorProfile("bad-token")).resolves.toBe(false);

    expect(updateTag).not.toHaveBeenCalled();
  });

  it("checks the token against GET /api/v1/me without a cache", async () => {
    fetchMock.mockResolvedValue(json(200, meFor("tutor_1")));

    await refreshMyTutorProfile("tutor-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/me$/);
    expect(init).toMatchObject({
      cache: "no-store",
      headers: expect.objectContaining({
        Authorization: "Bearer tutor-token",
      }),
    });
  });

  it("expires the tag for the signed-in tutor's own profile id", async () => {
    fetchMock.mockResolvedValue(
      json(200, meFor("2f6c9a1e-0b7d-4c3a-9e8f-1a2b3c4d5e6f")),
    );

    await expect(refreshMyTutorProfile("tutor-token")).resolves.toBe(true);

    expect(updateTag).toHaveBeenCalledTimes(1);
    expect(updateTag).toHaveBeenCalledWith(
      "tutor:2f6c9a1e-0b7d-4c3a-9e8f-1a2b3c4d5e6f",
    );
  });

  it("refuses an account with no tutor profile", async () => {
    fetchMock.mockResolvedValue(json(200, meFor(null)));

    await expect(refreshMyTutorProfile("student-token")).resolves.toBe(false);

    expect(updateTag).not.toHaveBeenCalled();
  });

  it.each([
    ["a path separator", "tutor/../admin"],
    ["a space", "tutor 1"],
    ["an empty id", ""],
    ["a value longer than 64 characters", "a".repeat(65)],
    ["a non-string id", 42],
    ["a dot", "tutor.1"],
  ])("refuses a malformed id from the API (%s)", async (_label, id) => {
    fetchMock.mockResolvedValue(json(200, meFor(id)));

    await expect(refreshMyTutorProfile("tutor-token")).resolves.toBe(false);

    expect(updateTag).not.toHaveBeenCalled();
  });

  it("accepts an id at the 64-character limit", async () => {
    const id = "a".repeat(64);
    fetchMock.mockResolvedValue(json(200, meFor(id)));

    await expect(refreshMyTutorProfile("tutor-token")).resolves.toBe(true);

    expect(updateTag).toHaveBeenCalledWith(`tutor:${id}`);
  });

  it("refuses a response body that is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));

    await expect(refreshMyTutorProfile("tutor-token")).resolves.toBe(false);

    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("refreshTutorProfilesAsAdmin", () => {
  it("refuses a caller the API does not treat as an admin", async () => {
    fetchMock.mockResolvedValue(json(403, { error: "Forbidden" }));

    await expect(refreshTutorProfilesAsAdmin("tutor-token")).resolves.toBe(
      false,
    );

    expect(updateTag).not.toHaveBeenCalled();
  });

  it("reads the admin video queue with the smallest page size", async () => {
    fetchMock.mockResolvedValue(json(200, { videos: [], nextCursor: null }));

    await refreshTutorProfilesAsAdmin("admin-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/admin\/videos\?limit=1$/);
    expect(init).toMatchObject({
      cache: "no-store",
      headers: expect.objectContaining({
        Authorization: "Bearer admin-token",
      }),
    });
  });

  it("expires every cached tutor profile once an admin is confirmed", async () => {
    fetchMock.mockResolvedValue(json(200, { videos: [], nextCursor: null }));

    await expect(refreshTutorProfilesAsAdmin("admin-token")).resolves.toBe(
      true,
    );

    expect(updateTag).toHaveBeenCalledTimes(1);
    expect(updateTag).toHaveBeenCalledWith("tutors");
  });
});
