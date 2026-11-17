import { describe, expect, it } from "vitest";
import { validateCommission } from "@/lib/admin-settings";

describe("validateCommission", () => {
  it.each(["0", "5", "12.5", "99.99", "100", "100.00", " 7 ", ".5", "5."])(
    "accepts %j",
    (text) => {
      expect(validateCommission(text)).toBeUndefined();
    },
  );

  it.each(["", "   ", "abc", "-1", "101", "100.01", "1e2"])(
    "asks for a number from 0 to 100 for %j",
    (text) => {
      expect(validateCommission(text)).toBe("Enter a number from 0 to 100.");
    },
  );

  it("allows at most two decimal places", () => {
    expect(validateCommission("1.234")).toBe("Use at most 2 decimal places.");
    expect(validateCommission("0.001")).toBe("Use at most 2 decimal places.");
  });
});
