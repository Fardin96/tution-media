import { describe, expect, it } from "vitest";
import {
  discountText,
  promoState,
  validateCode,
  type AdminPromoCode,
} from "@/lib/admin-promo-codes";
import { formatAmount } from "@/lib/admin";

function promo(overrides: Partial<AdminPromoCode> = {}): AdminPromoCode {
  return {
    id: "promo-1",
    code: "SUMMER10",
    description: null,
    discountType: "PERCENT",
    discountValue: "10.00",
    maxDiscount: null,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    maxPerTutor: 1,
    isActive: true,
    redemptionCount: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    createdByName: "Farabi",
    ...overrides,
  };
}

describe("validateCode", () => {
  it("asks for a code when it is empty or only spaces", () => {
    expect(validateCode("")).toBe("Enter a code.");
    expect(validateCode("   ")).toBe("Enter a code.");
  });

  it("accepts 3 to 32 letters, digits, dashes and underscores", () => {
    expect(validateCode("EID-2026_A")).toBeUndefined();
    expect(validateCode("abc")).toBeUndefined();
    expect(validateCode("  SUMMER10  ")).toBeUndefined();
    expect(validateCode("a".repeat(32))).toBeUndefined();
  });

  it("rejects codes shorter than 3 or longer than 32 characters", () => {
    const message =
      "Use 3 to 32 letters, digits, - or _, starting with a letter or digit.";
    expect(validateCode("ab")).toBe(message);
    expect(validateCode("a".repeat(33))).toBe(message);
  });

  it("rejects a leading dash or underscore and other characters", () => {
    const message =
      "Use 3 to 32 letters, digits, - or _, starting with a letter or digit.";
    expect(validateCode("-ABC")).toBe(message);
    expect(validateCode("_ABC")).toBe(message);
    expect(validateCode("AB C")).toBe(message);
    expect(validateCode("AB.C")).toBe(message);
  });
});

describe("discountText", () => {
  it("reads a percent code with and without a cap", () => {
    expect(discountText(promo(), formatAmount)).toBe("10% off");
    expect(discountText(promo({ maxDiscount: "500.00" }), formatAmount)).toBe(
      "10% off (up to ৳500)",
    );
  });

  it("reads a taka code as an amount off", () => {
    expect(
      discountText(
        promo({ discountType: "FLAT", discountValue: "300.00" }),
        formatAmount,
      ),
    ).toBe("৳300 off");
  });

  it("drops trailing zeros from a percent value", () => {
    expect(discountText(promo({ discountValue: "12.50" }), formatAmount)).toBe(
      "12.5% off",
    );
  });
});

describe("promoState", () => {
  const NOW = new Date("2026-11-18T12:00:00.000Z");

  it("is active when on, started and inside its window", () => {
    expect(
      promoState(
        promo({
          startsAt: "2026-11-01T00:00:00.000Z",
          endsAt: "2026-12-01T00:00:00.000Z",
        }),
        NOW,
      ),
    ).toBe("active");
  });

  it("is off when turned off, whatever its dates say", () => {
    expect(promoState(promo({ isActive: false }), NOW)).toBe("off");
    expect(
      promoState(
        promo({ isActive: false, endsAt: "2020-01-01T00:00:00.000Z" }),
        NOW,
      ),
    ).toBe("off");
  });

  it("is scheduled before its start", () => {
    expect(
      promoState(promo({ startsAt: "2026-12-01T00:00:00.000Z" }), NOW),
    ).toBe("scheduled");
  });

  it("is ended once the end time has passed", () => {
    expect(promoState(promo({ endsAt: "2026-11-18T11:59:59.000Z" }), NOW)).toBe(
      "ended",
    );
  });

  it("is used up when redemptions reach the total", () => {
    expect(
      promoState(promo({ maxRedemptions: 5, redemptionCount: 5 }), NOW),
    ).toBe("used-up");
    expect(
      promoState(promo({ maxRedemptions: 5, redemptionCount: 4 }), NOW),
    ).toBe("active");
  });
});
