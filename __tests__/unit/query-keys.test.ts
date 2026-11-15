import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateTutorRequirements } from "@/lib/query-keys";

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
