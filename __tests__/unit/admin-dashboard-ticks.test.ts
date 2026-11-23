import { describe, expect, it } from "vitest";
import { pickTicks } from "@/components/admin/dashboard/series-widget";

const days = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(2026, 7, 26 + i)).toISOString().slice(0, 10),
  );

describe("pickTicks", () => {
  it("keeps every date when they all fit", () => {
    expect(pickTicks(days(7), 560)).toEqual(days(7));
  });

  it("always labels the latest date", () => {
    for (const width of [320, 390, 560, 1100])
      expect(pickTicks(days(90), width).at(-1)).toBe(days(90).at(-1));
  });

  it("leaves at least 64 px of plot between labels", () => {
    for (const [n, width] of [
      [30, 320],
      [30, 560],
      [90, 390],
      [12, 500],
    ] as const) {
      const ticks = pickTicks(days(n), width);
      const plot = width - 84;
      const indexes = ticks.map((t) => days(n).indexOf(t));
      for (let i = 1; i < indexes.length; i++)
        expect(
          ((indexes[i] - indexes[i - 1]) * plot) / n,
        ).toBeGreaterThanOrEqual(64);
    }
  });
});
