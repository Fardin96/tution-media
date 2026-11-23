"use client";

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
  RANGES,
  type DashboardRange,
  type SeriesPayload,
} from "@/lib/admin-dashboard";
import { bucketOf, formatBucket, formatCompact, formatMetric } from "./format";

const listFormat = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

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
  const { chart, format, series, points, totals, note } = payload;
  const bucket = bucketOf(points.map((p) => p.date));
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? range;

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
  )} over the last ${rangeLabel}.`;

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
      tickFormatter={(value: string) => formatBucket(value, bucket)}
    />,
    <YAxis
      key="y"
      tickLine={false}
      axisLine={false}
      width={56}
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
              style={{ backgroundColor: colour(s.key) }}
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
      <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
        {chart === "bar" ? (
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
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
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            {axes}
            {tooltip}
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stackId={chart === "stacked-area" ? "stack" : undefined}
                stroke={colour(s.key)}
                fill={colour(s.key)}
                fillOpacity={0.2}
                strokeWidth={2}
                dot={false}
                isAnimationActive={!reduce}
              />
            ))}
          </AreaChart>
        )}
      </ChartContainer>
      {note && (
        <p className="text-xs text-pretty text-[var(--color-text-secondary)]">
          {note}
        </p>
      )}
      <table className="sr-only">
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
    </figure>
  );
}
