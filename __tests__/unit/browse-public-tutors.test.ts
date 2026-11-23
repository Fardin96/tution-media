import { describe, it, expect } from "vitest";
import {
  publicTutorApiFilters,
  publicTutorFiltersFromSearchParams,
  publicTutorFiltersToSearchParams,
} from "@/lib/browse";
import { SEARCH_TEXT_MAX } from "@/lib/tutor-search";

const read = (query: string) =>
  publicTutorFiltersFromSearchParams(new URLSearchParams(query));

describe("public tutor filters in the URL", () => {
  it("round trips every filter", () => {
    const filters = {
      subject: 5,
      area: 3,
      district: "Dhaka",
      gender: "FEMALE" as const,
      emerging: true,
      q: "physics tutor",
      location: "Gulshan, Dhaka",
    };
    const params = publicTutorFiltersToSearchParams(filters);
    expect(publicTutorFiltersFromSearchParams(params)).toEqual(filters);
  });

  it("writes nothing for an empty filter set", () => {
    expect(publicTutorFiltersToSearchParams({}).toString()).toBe("");
  });

  it("writes sort only for emerging, and reads sort only as emerging", () => {
    expect(
      publicTutorFiltersToSearchParams({ emerging: true }).get("sort"),
    ).toBe("emerging");
    expect(
      publicTutorFiltersToSearchParams({ emerging: false }).has("sort"),
    ).toBe(false);
    expect(read("sort=emerging").emerging).toBe(true);
    expect(read("sort=newest").emerging).toBe(false);
    expect(read("").emerging).toBe(false);
  });

  it("drops garbage ids and values", () => {
    const f = read(
      "subject=abc&area=0&gender=ALIEN&district=&q=%20%20&location=",
    );
    expect(f.subject).toBeUndefined();
    expect(f.area).toBeUndefined();
    expect(f.gender).toBeUndefined();
    expect(f.district).toBeUndefined();
    expect(f.q).toBeUndefined();
    expect(f.location).toBeUndefined();
  });

  it("drops negative and fractional ids", () => {
    const f = read("subject=-1&area=1.5");
    expect(f.subject).toBeUndefined();
    expect(f.area).toBeUndefined();
  });

  it("drops ids too big for a Postgres int4 column", () => {
    const f = read("area=99999999999&subject=1e12");
    expect(f.area).toBeUndefined();
    expect(f.subject).toBeUndefined();
    expect(read("area=2147483647&subject=2147483647")).toMatchObject({
      area: 2147483647,
      subject: 2147483647,
    });
    expect(read("area=2147483648").area).toBeUndefined();
  });

  it("trims text and cuts it to the search limit", () => {
    expect(read("q=%20%20physics%20%20").q).toBe("physics");
    expect(read(`q=${"a".repeat(SEARCH_TEXT_MAX + 50)}`).q).toHaveLength(
      SEARCH_TEXT_MAX,
    );
    expect(
      read(`location=${"b".repeat(SEARCH_TEXT_MAX + 1)}`).location,
    ).toHaveLength(SEARCH_TEXT_MAX);
    expect(read(`district=${"d".repeat(120)}`).district).toHaveLength(80);
  });
});

describe("publicTutorApiFilters", () => {
  it("sends recent only for emerging, and never q or location", () => {
    expect(
      publicTutorApiFilters({
        subject: 1,
        q: "physics",
        location: "Gulshan",
        emerging: true,
      }),
    ).toEqual({ subject: 1, recent: "true" });
    expect(publicTutorApiFilters({ area: 2 })).toEqual({ area: 2 });
  });
});
