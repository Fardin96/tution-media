import { beforeEach, describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  invalidateApplications,
  invalidateRequirements,
  invalidateTutorProfile,
  invalidateTutorRequirements,
} from "@/lib/query-keys";
import { refreshMyTutorProfile } from "@/lib/tutor-profile.actions";

vi.mock("@/lib/tutor-profile.actions", () => ({
  refreshMyTutorProfile: vi.fn(),
}));

describe("tutor requirement keys", () => {
  const { requirements } = queryKeys.tutor;

  it("list defaults to the active status", () =>
    expect(requirements.list()).toEqual([
      "tutor",
      "requirements",
      { status: "active" },
    ]));

  it("list and detail return the expected arrays", () => {
    expect(requirements.list("archived")).toEqual([
      "tutor",
      "requirements",
      { status: "archived" },
    ]);
    expect(requirements.detail("abc")).toEqual([
      "tutor",
      "requirements",
      "abc",
    ]);
  });

  it("all is a prefix of list and detail", () => {
    expect(requirements.list().slice(0, 2)).toEqual(requirements.all);
    expect(requirements.detail("abc").slice(0, 2)).toEqual(requirements.all);
  });
});

describe("profile subjects key", () => {
  it("is a tutor-scoped key", () =>
    expect(queryKeys.tutor.profileSubjects).toEqual([
      "tutor",
      "profile-subjects",
    ]));
});

describe("lookup keys", () => {
  it("education lookup key", () =>
    expect(queryKeys.lookups.education).toEqual(["lookups", "education"]));
});

describe("invalidateTutorRequirements", () => {
  it("invalidates requirements, me and match", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");

    await invalidateTutorRequirements(client);

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls).toEqual([
      [{ queryKey: ["tutor", "requirements"] }],
      [{ queryKey: ["me"] }],
      [{ queryKey: ["match"] }],
    ]);
  });
});

describe("invalidateTutorProfile", () => {
  const TUTOR_ID = "tutor-1";

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(refreshMyTutorProfile).mockReset();
    vi.mocked(refreshMyTutorProfile).mockResolvedValue(true);
  });

  it("refreshes the public profile with the signed-in token", async () => {
    localStorage.setItem(
      "auth_tokens",
      JSON.stringify({ accessToken: "tutor-token", refreshToken: "refresh" }),
    );
    const client = new QueryClient();

    await invalidateTutorProfile(client, TUTOR_ID);

    expect(refreshMyTutorProfile).toHaveBeenCalledWith("tutor-token");
  });

  it("does not refresh the public profile when signed out", async () => {
    const client = new QueryClient();

    await invalidateTutorProfile(client, TUTOR_ID);

    expect(refreshMyTutorProfile).not.toHaveBeenCalled();
  });

  it("invalidates the tutor's client profile query and resolves to nothing", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");

    const result = await invalidateTutorProfile(client, TUTOR_ID);

    expect(result).toBeUndefined();
    expect(spy.mock.calls).toEqual([
      [{ queryKey: ["tutors", "profile", TUTOR_ID] }],
    ]);
  });

  it("still resolves when the refresh fails", async () => {
    localStorage.setItem(
      "auth_tokens",
      JSON.stringify({ accessToken: "tutor-token", refreshToken: "refresh" }),
    );
    vi.mocked(refreshMyTutorProfile).mockRejectedValue(
      new TypeError("fetch failed"),
    );
    const client = new QueryClient();

    await expect(
      invalidateTutorProfile(client, TUTOR_ID),
    ).resolves.toBeUndefined();
  });
});

describe("dashboard counts", () => {
  it("applications writes expire the stats through the me key that covers them", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");

    await invalidateApplications(client);

    expect(spy.mock.calls).toContainEqual([{ queryKey: queryKeys.me }]);
    expect(queryKeys.myStats.slice(0, 1)).toEqual(queryKeys.me);
  });

  it("requirement writes expire the list and the stats", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");

    await invalidateRequirements(client);

    expect(spy.mock.calls).toEqual([
      [{ queryKey: ["requirements"] }],
      [{ queryKey: ["me", "stats"] }],
    ]);
  });
});
