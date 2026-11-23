import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  bucketOf,
  deltaOf,
  formatBucket,
  formatCompact,
  formatMetric,
} from "@/components/admin/dashboard/format";

describe("formatMetric", () => {
  it("shows an em dash for no data", () => {
    expect(formatMetric(null, "count")).toBe("—");
    expect(formatMetric(null, "percent")).toBe("—");
  });

  it("formats counts as whole numbers", () => {
    expect(formatMetric(1234.6, "count")).toBe("1,235");
  });

  it("formats money with the admin amount rule", () => {
    expect(formatMetric(1537.5, "money")).toBe("৳1,537.50");
    expect(formatMetric(1500, "money")).toBe("৳1,500");
  });

  it("formats percent as 0 to 1 with no decimals, one under 10%", () => {
    expect(formatMetric(0.38, "percent")).toBe("38%");
    expect(formatMetric(0.045, "percent")).toBe("4.5%");
    expect(formatMetric(1, "percent")).toBe("100%");
  });

  it("formats days with singular for one", () => {
    expect(formatMetric(4.2, "days")).toBe("4.2 days");
    expect(formatMetric(1, "days")).toBe("1 day");
    expect(formatMetric(12, "days")).toBe("12 days");
  });
});

describe("formatCompact", () => {
  it("shortens counts for axis labels", () => {
    expect(formatCompact(1200, "count")).toBe("1.2K");
    expect(formatCompact(80, "count")).toBe("80");
  });
});

describe("deltaOf", () => {
  it("is null when either side is missing", () => {
    expect(deltaOf(null, 10, "count", true)).toBeNull();
    expect(deltaOf(10, null, "count", true)).toBeNull();
  });

  it("is null for a zero base on a non-percent metric", () => {
    expect(deltaOf(10, 0, "count", true)).toBeNull();
  });

  it("reports a rise as good when higher is better", () => {
    expect(deltaOf(120, 100, "count", true)).toEqual({
      text: "Up 20%",
      tone: "good",
      direction: "up",
    });
  });

  it("reports a fall as bad when higher is better", () => {
    expect(deltaOf(90, 100, "count", true)).toEqual({
      text: "Down 10%",
      tone: "bad",
      direction: "down",
    });
  });

  it("reverses the tone when lower is better", () => {
    expect(deltaOf(90, 100, "days", false)).toEqual({
      text: "Down 10%",
      tone: "good",
      direction: "down",
    });
  });

  it("measures percent metrics in points", () => {
    expect(deltaOf(0.35, 0.38, "percent", true)).toEqual({
      text: "Down 3 pts",
      tone: "bad",
      direction: "down",
    });
  });

  it("says no change when the rounded change is zero", () => {
    expect(deltaOf(0.38, 0.38, "percent", true)).toEqual({
      text: "No change",
      tone: "neutral",
      direction: "flat",
    });
    expect(deltaOf(100, 100, "count", true)?.text).toBe("No change");
  });
});

describe("formatBucket and bucketOf", () => {
  it("labels days and months", () => {
    expect(formatBucket("2026-11-03", "day")).toBe("3 Nov");
    expect(formatBucket("2026-11-01", "month")).toBe("Nov 2026");
  });

  it("detects monthly points from their spacing", () => {
    expect(bucketOf(["2026-10-01", "2026-11-01", "2026-12-01"])).toBe("month");
    expect(bucketOf(["2026-11-01", "2026-11-02", "2026-11-03"])).toBe("day");
  });
});

/* Chart colours must stay readable on the page and distinguishable from each other. */

const css = readFileSync(
  path.resolve(process.cwd(), "app/globals.css"),
  "utf8",
);

/** A hex value, or a var(--name) resolved to the hex that --name is set to in the same file. */
function resolveHex(value: string) {
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  if (!ref) return value.toLowerCase();
  const hex = new RegExp(`${ref[1]}:\\s*(#[0-9a-fA-F]{6});`).exec(css);
  if (!hex) throw new Error(`${ref[1]} has no hex value in globals.css`);
  return hex[1]!.toLowerCase();
}

function parseChartTokens() {
  const colours: string[] = [];
  for (const match of css.matchAll(
    /--chart-([1-4]):\s*(#[0-9a-fA-F]{6}|var\(--[\w-]+\));/g,
  )) {
    colours[Number(match[1]) - 1] = resolveHex(match[2]!);
  }
  return colours;
}

function luminance(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

describe("chart colour tokens", () => {
  const chart = parseChartTokens();

  it("defines --chart-1 to --chart-4 in app/globals.css", () => {
    expect(chart).toHaveLength(4);
    expect(chart.every(Boolean)).toBe(true);
  });

  it("gives each chart colour 3:1 or more on white and on the off-white page", () => {
    for (const background of ["#ffffff", "#fafafa"]) {
      for (const colour of chart) {
        expect(contrast(colour!, background)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps adjacent series at least 1.4:1 apart in luminance", () => {
    const pairs: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ];
    for (const [a, b] of pairs) {
      expect(contrast(chart[a]!, chart[b]!)).toBeGreaterThanOrEqual(1.4);
    }
  });
});
