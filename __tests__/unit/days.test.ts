import { describe, expect, it } from "vitest";
import {
  countDays,
  daysLabel,
  daysPerWeekError,
  daysPerWeekLabel,
  EVERY_DAY,
} from "@/lib/days";

describe("days helpers", () => {
  it("counts the bits set in an availableDays mask", () => {
    expect(countDays(EVERY_DAY)).toBe(7);
    expect(countDays(0)).toBe(0);
    expect(countDays(1)).toBe(1); // Saturday only
    expect(countDays(1 | 4)).toBe(2); // Saturday and Monday
    expect(countDays(64)).toBe(1); // Friday only
  });

  it("labels the mask as every day, no days, or the short day names", () => {
    expect(daysLabel(EVERY_DAY)).toBe("Every day");
    expect(daysLabel(0)).toBe("No days");
    expect(daysLabel(1 | 4)).toBe("Sat, Mon");
    expect(daysLabel(2 | 8 | 16 | 32 | 64)).toBe("Sun, Tue, Wed, Thu, Fri");
  });

  it("uses singular and plural for days per week", () => {
    expect(daysPerWeekLabel(1)).toBe("1 day a week");
    expect(daysPerWeekLabel(3)).toBe("3 days a week");
  });

  it("errors only when the day count exceeds the selected days", () => {
    expect(daysPerWeekError(2, 1 | 4)).toBeNull();
    expect(daysPerWeekError(2, 1 | 4 | 8)).toBeNull();
    expect(daysPerWeekError(5, EVERY_DAY)).toBeNull();
    expect(daysPerWeekError(3, 1 | 4)).toBe(
      "Pick at least 3 days, or fewer days a week.",
    );
  });

  it("never errors when days per week is null (any number)", () => {
    expect(daysPerWeekError(null, 1)).toBeNull();
  });
});
