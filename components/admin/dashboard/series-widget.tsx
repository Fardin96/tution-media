"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  COLOR_VAR,
  type DashboardRange,
  type SeriesPayload,
} from "@/lib/admin-dashboard";
import {
  bucketOf,
  formatBucket,
  formatCompact,
  formatMetric,
  overRange,
} from "./format";

const listFormat = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

/** Bars read well up to 14 points; past that each one is a few pixels wide, so the series draws as an area. */
const MAX_BARS = 14;

/** The chart a series draws as: a bar series with more than 14 points becomes a plain area. */
export function chartKind({
  chart,
  points,
}: Pick<SeriesPayload, "chart" | "points">): SeriesPayload["chart"] {
  return chart === "bar" && points.length > MAX_BARS ? "area" : chart;
}

/** Room one date label needs, in px: "Nov 2026" at 12px is about 55 px, plus a gap. */
const TICK_SPACE = 64;
/** Width of the Y axis plus the chart's right margin. */
const PLOT_INSET = 84;

/**
 * The dates to label on the X axis. Recharts' own collision check measures text, and that
 * differs between browsers (labels overlapped in Firefox), so ticks are picked from the plot
 * width instead: at least TICK_SPACE px apart, counted back from the latest date so "today"
 * is always labelled.
 */
export function pickTicks(dates: string[], width: number): string[] {
  const plot = Math.max(width - PLOT_INSET, 1);
  const step = Math.max(1, Math.ceil((TICK_SPACE * dates.length) / plot));
  const ticks: string[] = [];
  for (let i = dates.length - 1; i >= 0; i -= step) ticks.unshift(dates[i]);
  return ticks;
}

/** Width of an element, kept up to date. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function SeriesWidget({
  payload,
  title,
  range,
}: {
  payload: SeriesPayload;
  title: string;
  range: DashboardRange;
}) {
  const reduce = useReducedMotion() ?? false;
  const [plotRef, plotWidth] = useWidth();
  const { chart: declared, format, series, points, totals, note } = payload;
  const chart = chartKind(payload);
  // A bar series turned into an area keeps its lighter area fill.
  const asArea = declared === "bar" && chart === "area";
  const bucket = bucketOf(points.map((p) => p.date));

  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: COLOR_VAR[s.color] }]),
  );
  const data = points.map((p) => ({ date: p.date, ...p.values }));
  const empty = points.every((p) =>
    Object.values(p.values).every((v) => v === 0),
  );
  const summary = `${title}: ${listFormat.format(
    series.map(
      (s) =>
        `${formatMetric(totals[s.key] ?? null, format)} ${s.label.toLowerCase()}`,
    ),
  )} ${overRange(range)}.`;

  const colour = (key: string) => `var(--color-${key})`;
  const labelOf = (key: string) => config[key]?.label ?? key;

  if (empty) {
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Nothing in this period yet.
      </p>
    );
  }

  const tooltip = (
    <ChartTooltip
      cursor={chart === "bar"}

      content={
        <ChartTooltipContent
          labelFormatter={(label) => formatBucket(String(label), bucket)}
          formatter={(value, name) => (
            <div className="flex w-full items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <span
                  aria-hidden
                  className="size-2.5 rounded-[2px]"
                  style={{ backgroundColor: colour(String(name)) }}
                />
                {labelOf(String(name))}
              </span>
              <span className="font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
                {formatMetric(Number(value), format)}
              </span>
            </div>
          )}
        />
      }
    />
  );

  const dates = data.map((d) => d.date);
  const ticks = plotWidth > 0 ? pickTicks(dates, plotWidth) : [];

  const axes = [
    <CartesianGrid
      key="grid"
      vertical={false}
      stroke="var(--color-neutral-border)"
    />,
    <XAxis
      key="x"
      dataKey="date"
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      ticks={ticks}
      interval={0}
      tick={{ fontSize: 12 }}
      tickFormatter={(value: string) => formatBucket(value, bucket)}
    />,
    <YAxis
      key="y"
      tickLine={false}
      axisLine={false}
      width={52}
      // Counts are whole people or payments: no 0.5 ticks.
      allowDecimals={format !== "count"}
      tick={{ fontSize: 12 }}
      tickFormatter={(value: number) => formatCompact(value, format)}
    />,
  ];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">{summary}</figcaption>
      <ul
        aria-label="Totals"
        className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
      >
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: COLOR_VAR[s.color] }}
            />
            <span className="text-[var(--color-text-secondary)]">
              {s.label}
            </span>
            <span className="font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
              {formatMetric(totals[s.key] ?? null, format)}
            </span>
          </li>
        ))}
      </ul>
      <div ref={plotRef}>
        <ChartContainer
          config={config}
          className="aspect-auto h-[240px] w-full"
        >
          {chart === "bar" ? (
            <BarChart
              accessibilityLayer
              data={data}
              margin={{ top: 8, right: 32, bottom: 0, left: 0 }}
              barCategoryGap="15%"
              barGap={2}
            >
              {axes}
              {tooltip}
              {series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  fill={colour(s.key)}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={!reduce}
                />
              ))}
            </BarChart>
          ) : (
            <AreaChart
              accessibilityLayer
              data={data}
              margin={{ top: 8, right: 32, bottom: 0, left: 0 }}
            >
              {axes}
              {tooltip}
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  stackId={chart === "stacked-area" ? "stack" : undefined}
                  stroke={colour(s.key)}
                  fill={colour(s.key)}
                  fillOpacity={asArea ? 0.15 : 0.2}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!reduce}
                />
              ))}
            </AreaChart>
          )}
        </ChartContainer>
      </div>
      {note && (
        <p className="text-xs text-pretty text-[var(--color-text-secondary)]">
          {note}
        </p>
      )}
      {/* sr-only on the wrapper: Firefox draws a table's caption outside the table box, so it escaped the clip. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <th scope="row">{formatBucket(p.date, bucket)}</th>
                {series.map((s) => (
                  <td key={s.key}>
                    {formatMetric(p.values[s.key] ?? null, format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
