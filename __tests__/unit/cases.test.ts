import { describe, it, expect } from "vitest";
import {
  CASE_STATUS_META,
  DISPUTE_TYPE_LABEL,
  REPORT_CATEGORY_LABEL,
  isCaseActive,
  validateCaseDetails,
} from "@/lib/cases";

describe("validateCaseDetails", () => {
  it("asks for at least 10 characters", () => {
    expect(validateCaseDetails("")).toBe("Write at least 10 characters.");
    expect(validateCaseDetails("   too short ")).toBe(
      "Write at least 10 characters.",
    );
  });

  it("accepts 10 to 2000 characters after trimming", () => {
    expect(validateCaseDetails("a".repeat(10))).toBeUndefined();
    expect(validateCaseDetails(`  ${"a".repeat(2000)}  `)).toBeUndefined();
  });

  it("rejects more than 2000", () => {
    expect(validateCaseDetails("a".repeat(2001))).toBe(
      "Keep it to 2000 characters or fewer.",
    );
  });
});

describe("case labels", () => {
  it("labels every status", () => {
    expect(CASE_STATUS_META.OPEN.label).toBe("Received");
    expect(CASE_STATUS_META.UNDER_REVIEW.label).toBe("Being looked at");
    expect(CASE_STATUS_META.RESOLVED.label).toBe("Resolved");
    expect(CASE_STATUS_META.DISMISSED.label).toBe("Closed");
  });

  it("labels every category and type", () => {
    expect(Object.keys(REPORT_CATEGORY_LABEL)).toHaveLength(7);
    expect(Object.keys(DISPUTE_TYPE_LABEL)).toHaveLength(5);
  });

  it("treats only open and under review as active", () => {
    expect(isCaseActive("OPEN")).toBe(true);
    expect(isCaseActive("UNDER_REVIEW")).toBe(true);
    expect(isCaseActive("RESOLVED")).toBe(false);
    expect(isCaseActive("DISMISSED")).toBe(false);
  });
});
