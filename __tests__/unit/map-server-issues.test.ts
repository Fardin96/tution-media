import { describe, expect, it } from "vitest";
import { mapServerIssuesToFields } from "@/lib/api-errors";
import type {
  RequirementForm,
  RequirementFormErrors,
} from "@/lib/requirements";

describe("mapServerIssuesToFields", () => {
  it("returns an empty object for undefined or an empty list", () => {
    expect(mapServerIssuesToFields(undefined)).toEqual({});
    expect(mapServerIssuesToFields([])).toEqual({});
  });

  it("keys by the first path segment", () => {
    expect(
      mapServerIssuesToFields([{ path: ["subjectIds", 0], message: "a" }]),
    ).toEqual({ subjectIds: "a" });
  });

  it.each(["body", "query", "params"])(
    "strips a leading %s segment",
    (prefix) => {
      expect(
        mapServerIssuesToFields([
          { path: [prefix, "classLevel"], message: "bad" },
        ]),
      ).toEqual({ classLevel: "bad" });
    },
  );

  it("skips an issue whose path is only a prefix", () => {
    expect(mapServerIssuesToFields([{ path: ["body"], message: "x" }])).toEqual(
      {},
    );
  });

  it("keeps the first message for a duplicate key", () => {
    expect(
      mapServerIssuesToFields([
        { path: ["salary"], message: "first" },
        { path: ["body", "salary"], message: "second" },
      ]),
    ).toEqual({ salary: "first" });
  });

  it("turns numeric first segments into string keys", () => {
    const out = mapServerIssuesToFields([{ path: [2, "x"], message: "n" }]);
    expect(out).toEqual({ "2": "n" });
    expect(Object.keys(out)).toEqual(["2"]);
  });

  it("produces a value that matches RequirementFormErrors", () => {
    const e: RequirementFormErrors = mapServerIssuesToFields<
      keyof RequirementForm
    >([{ path: ["body", "daysPerWeek"], message: "Too many" }]);
    expect(e.daysPerWeek).toBe("Too many");
  });
});
