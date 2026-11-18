import { describe, expect, it } from "vitest";
import { formatAmount } from "@/lib/admin";

describe("formatAmount", () => {
  it("drops the decimals of whole amounts", () => {
    expect(formatAmount("1500.00")).toBe("৳1,500");
    expect(formatAmount(0)).toBe("৳0");
  });

  it("always shows two decimals when there are paisa", () => {
    expect(formatAmount("1537.50")).toBe("৳1,537.50");
    expect(formatAmount("33.75")).toBe("৳33.75");
    expect(formatAmount(0.5)).toBe("৳0.50");
  });

  it("returns anything that is not a number as it came", () => {
    expect(formatAmount("n/a")).toBe("n/a");
  });
});
