import { describe, expect, it } from "vitest";
import {
  formatDueDate,
  localDateTimeToIso,
  localDateTimeValue,
  parseAmount,
  validateAmount,
  validateReason,
} from "@/lib/admin-fees";

describe("validateAmount", () => {
  it("asks for an amount when the field is empty or not a number", () => {
    expect(validateAmount("")).toBe("Enter an amount in taka.");
    expect(validateAmount("   ")).toBe("Enter an amount in taka.");
    expect(validateAmount("abc")).toBe("Enter an amount in taka.");
    expect(validateAmount("-5")).toBe("Enter an amount in taka.");
    expect(validateAmount("1e3")).toBe("Enter an amount in taka.");
  });

  it("rejects zero", () => {
    expect(validateAmount("0")).toBe("Enter an amount in taka.");
    expect(validateAmount("0.00")).toBe("Enter an amount in taka.");
  });

  it("allows at most two decimal places", () => {
    expect(validateAmount("12.5")).toBeUndefined();
    expect(validateAmount("12.50")).toBeUndefined();
    expect(validateAmount("12.345")).toBe("Use at most 2 decimal places.");
  });

  it("accepts thousands separators", () => {
    expect(validateAmount("1,500")).toBeUndefined();
    expect(parseAmount("1,500.50")).toBe(1500.5);
  });

  it("refuses more than the amount still due", () => {
    expect(validateAmount("200", 200)).toBeUndefined();
    expect(validateAmount("200", "200.00")).toBeUndefined();
    expect(validateAmount("250", 200)).toBe("More than the ৳200 still due.");
    expect(validateAmount("200.01", "200.00")).toBe(
      "More than the ৳200 still due.",
    );
  });

  it("checks the amount format before the maximum", () => {
    expect(validateAmount("abc", 200)).toBe("Enter an amount in taka.");
  });
});

describe("validateReason", () => {
  it("needs at least three characters after trimming", () => {
    expect(validateReason("")).toBeDefined();
    expect(validateReason("ab")).toBeDefined();
    expect(validateReason("   ab   ")).toBeDefined();
    expect(validateReason("abc")).toBeUndefined();
    expect(validateReason("  abc  ")).toBeUndefined();
  });

  it("allows up to 500 characters and no more", () => {
    expect(validateReason("a".repeat(500))).toBeUndefined();
    expect(validateReason("a".repeat(501))).toBe(
      "Keep the reason to 500 characters or fewer.",
    );
  });
});

describe("date helpers", () => {
  it("formats a due date without shifting the day", () => {
    expect(formatDueDate("2026-11-17")).toBe("17 Nov 2026");
    expect(formatDueDate("2026-01-01")).toBe("1 Jan 2026");
  });

  it("round-trips a datetime-local value", () => {
    const value = localDateTimeValue(new Date(2026, 10, 17, 9, 5));
    expect(value).toBe("2026-11-17T09:05");
    const iso = localDateTimeToIso(value);
    expect(iso).toBe(new Date(2026, 10, 17, 9, 5).toISOString());
  });

  it("returns undefined for a datetime that does not parse", () => {
    expect(localDateTimeToIso("")).toBeUndefined();
  });
});
