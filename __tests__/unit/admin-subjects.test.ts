import { describe, expect, it } from "vitest";
import {
  validateSlug,
  validateSortOrder,
  validateSubjectName,
} from "@/lib/admin-subjects";

describe("validateSubjectName", () => {
  it("accepts a name of 2 to 60 characters", () => {
    expect(validateSubjectName("ICT")).toBeUndefined();
    expect(validateSubjectName("Hi")).toBeUndefined();
    expect(validateSubjectName("a".repeat(60))).toBeUndefined();
  });

  it("trims before checking", () => {
    expect(validateSubjectName("   ")).toBe("Enter a subject name.");
    expect(validateSubjectName("  A  ")).toBe("Use at least 2 characters.");
  });

  it("rejects a name longer than 60 characters", () => {
    expect(validateSubjectName("a".repeat(61))).toBe(
      "Use 60 characters or fewer.",
    );
  });
});

describe("validateSlug", () => {
  it("treats an empty slug as optional", () => {
    expect(validateSlug("")).toBeUndefined();
    expect(validateSlug("   ")).toBeUndefined();
  });

  it("accepts lowercase letters, numbers and single dashes", () => {
    expect(validateSlug("general-science")).toBeUndefined();
    expect(validateSlug("ict")).toBeUndefined();
    expect(validateSlug("a1-b2")).toBeUndefined();
  });

  it.each(["General", "higher math", "-ict", "ict-", "a--b", "a_b", "স"])(
    "rejects %j",
    (slug) => {
      expect(validateSlug(slug)).toBe(
        "Use lowercase letters, numbers and dashes.",
      );
    },
  );
});

describe("validateSortOrder", () => {
  it("accepts whole numbers from 0 to 1000", () => {
    expect(validateSortOrder("0")).toBeUndefined();
    expect(validateSortOrder("1000")).toBeUndefined();
  });

  it.each(["", "-1", "1001", "2.5", "abc"])("rejects %j", (text) => {
    expect(validateSortOrder(text)).toBe(
      "Enter a whole number from 0 to 1000.",
    );
  });
});
