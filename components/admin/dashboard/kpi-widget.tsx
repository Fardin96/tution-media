"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { CountingNumber } from "@/components/motion/counting-number";
import type { KpiPayload } from "@/lib/admin-dashboard";
import { cn } from "@/lib/utils";
import { deltaOf, formatMetric, type Delta } from "./format";

// Module level, so CountingNumber keeps the same format between renders.
const countFormat = (n: number) => Math.round(n).toLocaleString("en-US");

const TONE: Record<Delta["tone"], string> = {
  good: "bg-[var(--color-semantic-success-surface)] text-[var(--status-good)]",
  bad: "bg-[var(--color-semantic-error-surface)] text-[var(--status-bad)]",
  neutral:
    "bg-[var(--color-neutral-off-white)] text-[var(--color-text-secondary)]",
};

const ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

export function KpiWidget({ payload }: { payload: KpiPayload }) {
  const { value, previous, format, higherIsBetter, breakdown, note, spark } =
    payload;
  const delta = deltaOf(value, previous, format, higherIsBetter);
  const points = spark.map((point) => ({
    date: point.date,
    v:
      point.values.value ??
      Object.values(point.values).reduce((sum, n) => sum + n, 0),
  }));
  const Icon = delta ? ICON[delta.direction] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-3xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] tabular-nums">
          {value === null ? (
            "—"
          ) : format === "count" ? (
            <CountingNumber value={value} format={countFormat} />
          ) : (
            formatMetric(value, format)
          )}
        </p>
        {delta && Icon && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap tabular-nums",
                TONE[delta.tone],
              )}
            >
              <Icon aria-hidden className="size-3.5" />
              {delta.text}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              vs the period before
            </span>
          </div>
        )}
      </div>

      {breakdown.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-secondary)]">
          {breakdown.map((item) => (
            <li key={item.label}>
              {item.label}{" "}
              <span className="font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
                {formatMetric(item.value, format)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {value === null || points.length < 2 ? (
        <div className="flex h-10 items-center justify-center rounded-[12px] border border-dashed border-[var(--color-neutral-border)] text-xs text-[var(--color-text-secondary)]">
          Not enough data yet
        </div>
      ) : (
        <div aria-hidden="true" className="h-10 w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 1, height: 1 }}
          >
            <AreaChart
              data={points}
              margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
              accessibilityLayer={false}
            >
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="var(--chart-1)"
                fillOpacity={0.2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {note && (
        <p className="text-xs text-pretty text-[var(--color-text-secondary)]">
          {note}
        </p>
      )}
    </div>
  );
}
