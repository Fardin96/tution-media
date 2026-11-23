"use client";

import { useReducedMotion } from "motion/react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { COLOR_VAR, type DonutPayload } from "@/lib/admin-dashboard";
import { formatMetric } from "./format";

/**
 * A donut with its centre value. Slice names and numbers sit in a list beside it (the fallback
 * for outside labels, which would crowd here), so every label is readable text in the page.
 */
export function DonutWidget({
  payload,
  title,
}: {
  payload: DonutPayload;
  title: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const { slices, center, format, note } = payload;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (total === 0) {
    return (
      <p className="flex h-[200px] items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Nothing in this period yet.
      </p>
    );
  }

  const summary = `${title}: ${slices
    .map((s) => `${s.label} ${formatMetric(s.value, format)}`)
    .join(", ")}.`;
  const data = slices.map((s) => ({ name: s.label, value: s.value }));

  return (
    <figure className="@container">
      <div className="flex flex-col items-center gap-6 @md:flex-row">
        <figcaption className="sr-only">{summary}</figcaption>
        <div aria-hidden="true" className="relative size-[176px] shrink-0">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 1, height: 1 }}
          >
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="60%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="var(--color-neutral-white)"
                strokeWidth={2}
                isAnimationActive={!reduce}
              >
                {slices.map((s) => (
                  <Cell key={s.key} fill={COLOR_VAR[s.color]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {center.label}
            </span>
            <span className="text-xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] tabular-nums">
              {formatMetric(center.value, center.format)}
            </span>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-3">
          <ul aria-hidden="true" className="grid gap-2 text-sm">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: COLOR_VAR[s.color] }}
                />
                <span className="min-w-0 flex-1 text-[var(--color-neutral-charcoal)]">
                  {s.label}
                </span>
                <span className="font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
                  {formatMetric(s.value, format)}
                </span>
                <span className="w-12 text-right text-[var(--color-text-secondary)] tabular-nums">
                  {formatMetric(s.value / total, "percent")}
                </span>
              </li>
            ))}
          </ul>
          {note && (
            <p className="text-xs text-pretty text-[var(--color-text-secondary)]">
              {note}
            </p>
          )}
        </div>
      </div>

      {/* sr-only on the wrapper: Firefox draws a table's caption outside the table box, so it escaped the clip. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Slice</th>
              <th scope="col">Value</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((s) => (
              <tr key={s.key}>
                <th scope="row">{s.label}</th>
                <td>{formatMetric(s.value, format)}</td>
                <td>{formatMetric(s.value / total, "percent")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
