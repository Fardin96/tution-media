import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/profile";
import { errorCodeMessage } from "@/lib/api-errors";
import { queryKeys } from "@/lib/query-keys";
import {
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

describe("package filters <-> search params", () => {
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
      "Finish your profile before applying: name, location pin, teaching area, phone verification, default requirement set.",
    );
  });

  it("drops repeated and unknown-empty entries", () => {
    const err = new ApiError("m", 403, {
      code: "PROFILE_INCOMPLETE",
      details: { missing: ["phone_number", "phone_number", ""] },
    });
    expect(errorCodeMessage(err)).toBe(
      "Finish your profile before applying: phone number.",
    );
  });

  it("falls back when details.missing is absent", () => {
    const err = new ApiError("m", 403, { code: "PROFILE_INCOMPLETE" });
    expect(errorCodeMessage(err)).toBe(
      "Complete your profile before applying.",
    );
  });
});
