import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/profile";
import { errorCodeMessage } from "@/lib/api-errors";
import { queryKeys } from "@/lib/query-keys";
import {
  dedupeBy,
  dedupeById,
  formatDistanceKm,
  packageFiltersFromSearchParams,
  packageFiltersToSearchParams,
  requirementFiltersFromSearchParams,
  requirementFiltersToSearchParams,
  tutorFiltersFromSearchParams,
  tutorFiltersToSearchParams,
  type PackageBrowseFilters,
  type RequirementBrowseFilters,
  type TutorSearchFilters,
} from "@/lib/browse";

describe("formatDistanceKm", () => {
  it("is empty when the distance is unknown", () => {
    expect(formatDistanceKm(null)).toBe("");
  });

  it("says under 1 km below one kilometre", () => {
    expect(formatDistanceKm(0.5)).toBe("Under 1 km");
    expect(formatDistanceKm(0)).toBe("Under 1 km");
  });

  it("shows halves with one decimal", () => {
    expect(formatDistanceKm(2.5)).toBe("2.5 km");
  });

  it("drops the decimal on whole kilometres", () => {
    expect(formatDistanceKm(2)).toBe("2 km");
    expect(formatDistanceKm(10)).toBe("10 km");
  });
});

describe("requirement filters <-> search params", () => {
  it("round-trips a full filter set", () => {
    const filters: RequirementBrowseFilters = {
      scope: "all",
      curriculum: "EM_IB",
      levelCode: 0,
      subjectId: 3,
      areaId: 7,
    };
    const params = requirementFiltersToSearchParams(filters);
    expect(requirementFiltersFromSearchParams(params)).toEqual(filters);
  });

  it("keeps level 0 and negative levels", () => {
    const zero = requirementFiltersToSearchParams({
      scope: "nearby",
      levelCode: 0,
    });
    expect(zero.get("levelCode")).toBe("0");
    expect(requirementFiltersFromSearchParams(zero).levelCode).toBe(0);

    const negative = requirementFiltersToSearchParams({
      scope: "nearby",
      levelCode: -1,
    });
    expect(requirementFiltersFromSearchParams(negative).levelCode).toBe(-1);
  });

  it("defaults the scope to nearby when the URL has none", () => {
    expect(
      requirementFiltersFromSearchParams(new URLSearchParams()).scope,
    ).toBe("nearby");
  });

  it("drops unknown curricula and non-integer numbers", () => {
    const parsed = requirementFiltersFromSearchParams(
      new URLSearchParams(
        "curriculum=NOPE&levelCode=2.5&subjectId=abc&areaId=0",
      ),
    );
    expect(parsed.curriculum).toBeUndefined();
    expect(parsed.levelCode).toBeUndefined();
    expect(parsed.subjectId).toBeUndefined();
    expect(parsed.areaId).toBeUndefined();
  });

  it("omits unset filters from the search params", () => {
    const params = requirementFiltersToSearchParams({ scope: "nearby" });
    expect([...params.keys()]).toEqual(["scope"]);
  });
});

describe("requirement set mode <-> search params", () => {
  it("writes only the scope and set in set mode", () => {
    const params = requirementFiltersToSearchParams({
      scope: "set",
      setId: "set-1",
      curriculum: "EM_IB",
      levelCode: 9,
      subjectId: 3,
      areaId: 7,
    });
    expect(Object.fromEntries(params)).toEqual({ scope: "set", set: "set-1" });
  });

  it("reads back set mode without the manual filters", () => {
    const parsed = requirementFiltersFromSearchParams(
      new URLSearchParams(
        "scope=set&set=set-1&curriculum=EM_IB&levelCode=9&subjectId=3&areaId=7",
      ),
    );
    expect(parsed).toEqual({ scope: "set", setId: "set-1" });
    expect(parsed).not.toHaveProperty("curriculum");
    expect(parsed).not.toHaveProperty("levelCode");
    expect(parsed).not.toHaveProperty("subjectId");
    expect(parsed).not.toHaveProperty("areaId");
  });

  it("leaves setId unset when set mode has no set in the URL", () => {
    const parsed = requirementFiltersFromSearchParams(
      new URLSearchParams("scope=set&set=%20%20"),
    );
    expect(parsed).toEqual({ scope: "set" });
    expect(parsed.setId).toBeUndefined();
  });

  it("drops set outside set mode", () => {
    const parsed = requirementFiltersFromSearchParams(
      new URLSearchParams("scope=all&set=set-1&subjectId=3"),
    );
    expect(parsed).not.toHaveProperty("setId");
    expect(parsed.subjectId).toBe(3);

    const params = requirementFiltersToSearchParams({
      scope: "nearby",
      setId: "set-1",
    });
    expect(params.has("set")).toBe(false);
    expect([...params.keys()]).toEqual(["scope"]);
  });

  it("keeps set-mode and manual filter keys apart in the query key", () => {
    expect(
      queryKeys.browse.requirements({ scope: "set", setId: "a" }),
    ).not.toEqual(queryKeys.browse.requirements({ scope: "set", setId: "b" }));
  });
});

describe("package filters <-> search params", () => {
  it("has no set mode, so scope=set falls back to nearby", () => {
    expect(
      packageFiltersFromSearchParams(new URLSearchParams("scope=set")).scope,
    ).toBe("nearby");
  });

  it("round-trips a full filter set", () => {
    const filters: PackageBrowseFilters = {
      scope: "nearby",
      curriculum: "BANGLA_MEDIUM",
      levelCode: -2,
      subjectId: 1,
    };
    expect(
      packageFiltersFromSearchParams(packageFiltersToSearchParams(filters)),
    ).toEqual(filters);
  });

  it("ignores area, which packages do not filter on", () => {
    const parsed = packageFiltersFromSearchParams(
      new URLSearchParams("areaId=4"),
    );
    expect(parsed).not.toHaveProperty("areaId");
  });
});

describe("tutor filters <-> search params", () => {
  it("round-trips a full filter set", () => {
    const filters: TutorSearchFilters = {
      area: 2,
      subject: 5,
      gender: "FEMALE",
      name: "Dorothy Wood",
    };
    expect(
      tutorFiltersFromSearchParams(tutorFiltersToSearchParams(filters)),
    ).toEqual(filters);
  });

  it("trims the name and drops a blank one", () => {
    expect(
      tutorFiltersFromSearchParams(new URLSearchParams("name=%20%20")).name,
    ).toBeUndefined();
    expect(
      tutorFiltersFromSearchParams(new URLSearchParams("name=%20Rahim%20"))
        .name,
    ).toBe("Rahim");
  });

  it("drops a gender outside the API enum", () => {
    expect(
      tutorFiltersFromSearchParams(new URLSearchParams("gender=ANY")).gender,
    ).toBeUndefined();
  });
});

describe("browse query keys", () => {
  it("requirement and package keys carry the filter object", () => {
    const filters = { scope: "nearby" as const, subjectId: 2 };
    expect(queryKeys.browse.requirements(filters)).toEqual([
      "browse",
      "requirements",
      filters,
    ]);
    expect(queryKeys.browse.packages(filters)).toEqual([
      "browse",
      "packages",
      filters,
    ]);
  });

  it("package detail and tutor keys", () => {
    expect(queryKeys.browse.package("p1")).toEqual(["browse", "package", "p1"]);
    expect(queryKeys.browse.tutors({ area: 1 })).toEqual([
      "browse",
      "tutors",
      { area: 1 },
    ]);
  });

  it("nearby tutors sit under the tutors prefix", () => {
    const nearby = queryKeys.browse.nearbyTutors(2000);
    expect(nearby).toEqual(["browse", "tutors", "nearby", 2000]);
    expect(nearby.slice(0, 2)).toEqual(["browse", "tutors"]);
  });

  it("every browse key starts with the browse prefix", () => {
    expect(queryKeys.browse.requirements({ scope: "all" })[0]).toBe(
      queryKeys.browse.all[0],
    );
  });
});

describe("PROFILE_INCOMPLETE message", () => {
  it("lists the missing items in readable form", () => {
    const err = new ApiError("m", 403, {
      code: "PROFILE_INCOMPLETE",
      details: {
        missing: [
          "name",
          "location_pin",
          "area",
          "phone_verification",
          "default_requirement",
        ],
      },
    });
    expect(errorCodeMessage(err)).toBe(
      "Finish your profile first: name, location pin, teaching area, phone verification, default set with a zone or online teaching.",
    );
  });

  it("drops repeated and unknown-empty entries", () => {
    const err = new ApiError("m", 403, {
      code: "PROFILE_INCOMPLETE",
      details: { missing: ["phone_number", "phone_number", ""] },
    });
    expect(errorCodeMessage(err)).toBe(
      "Finish your profile first: phone number.",
    );
  });

  it("falls back when details.missing is absent", () => {
    const err = new ApiError("m", 403, { code: "PROFILE_INCOMPLETE" });
    expect(errorCodeMessage(err)).toBe("Complete your profile first.");
  });
});

describe("requirement invited and sort <-> search params", () => {
  it("round-trips the invited scope with nothing else", () => {
    const params = requirementFiltersToSearchParams({
      scope: "invited",
      subjectId: 3,
    });
    expect(Object.fromEntries(params)).toEqual({ scope: "invited" });
    expect(requirementFiltersFromSearchParams(params)).toEqual({
      scope: "invited",
    });
  });

  it("writes sort=newest in set mode and omits the default", () => {
    const newest = requirementFiltersToSearchParams({
      scope: "set",
      setId: "set-1",
      sort: "newest",
    });
    expect(Object.fromEntries(newest)).toEqual({
      scope: "set",
      set: "set-1",
      sort: "newest",
    });
    expect(requirementFiltersFromSearchParams(newest).sort).toBe("newest");

    const best = requirementFiltersToSearchParams({
      scope: "set",
      setId: "set-1",
      sort: "match",
    });
    expect(best.has("sort")).toBe(false);
    expect(requirementFiltersFromSearchParams(best)).not.toHaveProperty("sort");
  });

  it("drops sort outside set mode", () => {
    const params = requirementFiltersToSearchParams({
      scope: "all",
      sort: "newest",
    });
    expect(params.has("sort")).toBe(false);
    expect(
      requirementFiltersFromSearchParams(
        new URLSearchParams("scope=all&sort=newest"),
      ),
    ).not.toHaveProperty("sort");
  });

  it("reads an unknown scope as nearby", () => {
    expect(
      requirementFiltersFromSearchParams(new URLSearchParams("scope=invitd"))
        .scope,
    ).toBe("nearby");
  });
});

describe("dedupeBy and dedupeById", () => {
  it("keeps the first row for each id and the order", () => {
    const rows = [
      { id: "a", n: 1 },
      { id: "b", n: 2 },
      { id: "a", n: 3 },
    ];
    expect(dedupeById(rows)).toEqual([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ]);
  });

  it("dedupes on a key function", () => {
    const rows = [
      { tutor: { id: "t1" }, score: 1 },
      { tutor: { id: "t1" }, score: 2 },
    ];
    expect(dedupeBy(rows, (row) => row.tutor.id)).toEqual([
      { tutor: { id: "t1" }, score: 1 },
    ]);
  });

  it("returns an empty list unchanged", () => {
    expect(dedupeById([])).toEqual([]);
  });
});
