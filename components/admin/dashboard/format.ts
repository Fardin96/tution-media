import { formatAmount } from "@/lib/admin";
import {
  RANGES,
  type DashboardRange,
  type MetricFormat,
} from "@/lib/admin-dashboard";

const COUNT = new Intl.NumberFormat("en-US");
const COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const PERCENT_TENTHS = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** A metric as text. `null` (no data yet) is an em dash. */
export function formatMetric(value: number | null, format: MetricFormat) {
  if (value === null || !Number.isFinite(value)) return "—";
  switch (format) {
    case "count":
      return COUNT.format(Math.round(value));
    case "money":
      return formatAmount(value);
    case "percent":
      return formatPercent(value);
    case "days":
      return formatDays(value);
  }
}

/** Axis labels: counts and money shorten ("1.2K"); other formats read as usual. */
export function formatCompact(value: number, format: MetricFormat) {
  if (format === "count") return COMPACT.format(value);
  if (format === "money") return `৳${COMPACT.format(value)}`;
  return formatMetric(value, format);
}

/** 0..1 to "38%"; one decimal under 10% ("4.5%"). */
function formatPercent(value: number) {
  const pct = value * 100;
  if (Math.abs(pct) < 10) return `${PERCENT_TENTHS.format(pct)}%`;
  return `${Math.round(pct)}%`;
}

/** "4.2 days", "1 day", "12 days". */
function formatDays(value: number) {
  const tenths = Math.round(value * 10) / 10;
  if (tenths === 1) return "1 day";
  const text = Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
  return `${text} days`;
}

export type Delta = {
  text: string;
  tone: "good" | "bad" | "neutral";
  direction: "up" | "down" | "flat";
};

/**
 * Change from the previous period. Percent metrics move in points ("Down 3 pts"), the rest in
 * per cent ("Up 12%"). Null when either side is missing, or when a non-percent base is zero.
 */
export function deltaOf(
  value: number | null,
  previous: number | null,
  format: MetricFormat,
  higherIsBetter: boolean,
): Delta | null {
  if (value === null || previous === null) return null;
  if (!Number.isFinite(value) || !Number.isFinite(previous)) return null;

  let change: number;
  let unit: string;
  if (format === "percent") {
    change = Math.round((value - previous) * 100);
    unit = Math.abs(change) === 1 ? " pt" : " pts";
  } else {
    if (previous === 0) return null;
    change = Math.round(((value - previous) / Math.abs(previous)) * 100);
    unit = "%";
  }

  if (change === 0) {
    return { text: "No change", tone: "neutral", direction: "flat" };
  }
  const up = change > 0;
  const text = `${up ? "Up" : "Down"} ${Math.abs(change)}${unit}`;
  const good = up === higherIsBetter;
  return {
    text,
    tone: good ? "good" : "bad",
    direction: up ? "up" : "down",
  };
}

/**
 * The label for a series point. Days read "3 Nov"; months read "Nov 2026". Date-only values
 * are parsed as UTC so the label never shifts a day.
 */
export function formatBucket(date: string, bucket: "day" | "month" = "day") {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00Z`)
    : new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  if (bucket === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
  }
  return (
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
      .format(parsed)
      // en-GB writes "Sept"; every other month is three letters.
      .replace("Sept", "Sep")
  );
}

/** "month" when the points are roughly a month apart, else "day". */
export function bucketOf(dates: string[]): "day" | "month" {
  if (dates.length < 2) return "day";
  const first = new Date(dates[0]!).getTime();
  const second = new Date(dates[1]!).getTime();
  const days = Math.abs(second - first) / 86_400_000;
  return days > 20 ? "month" : "day";
}

/** The period a summary covers: "over all time" or "over the last 30 days". */
export function overRange(range: DashboardRange) {
  if (range === "all") return "over all time";
  const label = RANGES.find((r) => r.value === range)?.label ?? range;
  return `over the last ${label}`;
}
