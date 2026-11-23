import { describe, expect, it } from "vitest";
import type { AreaOption } from "@/lib/areas";
import {
  placeLabel,
  resolvePlace,
  resolveSubject,
  subjectQuery,
  suggestPlaces,
  suggestSubjects,
} from "@/lib/tutor-search";

const SUBJECTS = [
  { id: 1, name: "Mathematics" },
  { id: 2, name: "Physics" },
  { id: 3, name: "English" },
  { id: 4, name: "Higher Mathematics" },
];

const AREAS: AreaOption[] = [
  { id: 10, name: "Gulshan", district: "Dhaka" },
  { id: 11, name: "Dhanmondi", district: "Dhaka" },
  { id: 12, name: "Sadar", district: "Gazipur" },
  { id: 13, name: "Sadar", district: "Cumilla" },
];

describe("subjectQuery", () => {
  it("drops role words and tidies spaces", () => {
    expect(subjectQuery("  Math   Tutor ")).toBe("Math");
    expect(subjectQuery("Physics teachers")).toBe("Physics");
    expect(subjectQuery("tutor")).toBe("");
  });
});

describe("resolveSubject", () => {
  it("matches a name exactly, ignoring case and role words", () => {
    expect(resolveSubject("physics TEACHER", SUBJECTS)?.id).toBe(2);
    expect(resolveSubject("English", SUBJECTS)?.id).toBe(3);
  });

  it("takes a name that contains the text, first in list order", () => {
    expect(resolveSubject("Math tutor", SUBJECTS)?.id).toBe(1);
  });

  it("keeps a role word that is part of a subject's name", () => {
    const list = [
      { id: 7, name: "Economics" },
      { id: 8, name: "Home Economics" },
    ];
    expect(resolveSubject("Home Economics", list)?.id).toBe(8);
    expect(resolveSubject("home economics tutor", list)?.id).toBe(8);
    expect(suggestSubjects("Home Econ", list)[0].entry.id).toBe(8);
    expect(resolveSubject("Economics teacher", list)?.id).toBe(7);
    expect(suggestSubjects("home economics tutor", list)[0].entry.id).toBe(8);
  });

  it("never guesses from a typo or nothing", () => {
    expect(resolveSubject("Phsyics", SUBJECTS)).toBeNull();
    expect(resolveSubject("SSC package", SUBJECTS)).toBeNull();
    expect(resolveSubject("   ", SUBJECTS)).toBeNull();
    expect(resolveSubject("Math", [])).toBeNull();
  });
});

describe("resolvePlace", () => {
  it("resolves an area, with or without its district", () => {
    expect(resolvePlace("gulshan", AREAS)).toEqual({
      kind: "area",
      id: 10,
      name: "Gulshan",
      district: "Dhaka",
    });
    expect(resolvePlace("Gulshan, Dhaka", AREAS)).toMatchObject({ id: 10 });
  });

  it("resolves a district", () => {
    expect(resolvePlace(" dhaka ", AREAS)).toEqual({
      kind: "district",
      name: "Dhaka",
    });
    expect(resolvePlace(", Dhaka", AREAS)).toEqual({
      kind: "district",
      name: "Dhaka",
    });
  });

  it("does not guess between two areas with the same name", () => {
    expect(resolvePlace("Sadar", AREAS)).toBeNull();
    expect(resolvePlace("Sadar, Gazipur", AREAS)).toMatchObject({ id: 12 });
  });

  it("returns null for unknown places", () => {
    expect(resolvePlace("Chattogram", AREAS)).toBeNull();
    expect(resolvePlace("", AREAS)).toBeNull();
    expect(resolvePlace("Gulshan, Gazipur", AREAS)).toBeNull();
  });
});

describe("suggestions", () => {
  it("suggests subjects with match ranges", () => {
    const [first] = suggestSubjects("phys", SUBJECTS);
    expect(first.entry.id).toBe(2);
    expect(first.ranges).toEqual([[0, 4]]);
  });

  it("puts the district first and narrows areas after a comma", () => {
    expect(suggestPlaces("Dhaka", AREAS)[0].entry).toEqual({
      kind: "district",
      name: "Dhaka",
    });
    const narrowed = suggestPlaces("Sadar, gaz", AREAS).map((s) => s.entry);
    expect(narrowed).toEqual([
      { kind: "area", id: 12, name: "Sadar", district: "Gazipur" },
    ]);
    expect(suggestPlaces("   ", AREAS)).toEqual([]);
  });

  it("labels places", () => {
    expect(placeLabel({ kind: "district", name: "Dhaka" })).toBe("Dhaka");
    expect(
      placeLabel({ kind: "area", id: 10, name: "Gulshan", district: "Dhaka" }),
    ).toBe("Gulshan, Dhaka");
  });
});
