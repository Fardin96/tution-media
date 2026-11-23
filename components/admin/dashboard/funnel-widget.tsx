"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/profile/styles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FunnelPayload } from "@/lib/admin-dashboard";
import { formatMetric } from "./format";

type Funnel = FunnelPayload["funnels"][number];
type Stage = Funnel["stages"][number];

/** "Where it's stuck": a "Stuck at" strip of flagged steps, then each funnel as step columns. */
export function FunnelWidget({ payload }: { payload: FunnelPayload }) {
  const { funnels } = payload;
  const [tab, setTab] = useState<string>(funnels[0]?.key ?? "placement");

  const flags = funnels.flatMap((funnel) =>
    funnel.stages.flatMap((stage, i) =>
      stage.flagged
        ? [{ funnel, stage, previous: funnel.stages[i - 1] ?? null }]
        : [],
    ),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
          Stuck at
        </p>
        {flags.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Nothing flagged.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {flags.map(({ funnel, stage, previous }) => (
              <li key={`${funnel.key}-${stage.key}`} className="max-w-full">
                <button
                  type="button"
                  onClick={() => setTab(funnel.key)}
                  className={cn(
                    "inline-flex min-h-11 max-w-full items-center gap-2 rounded-[22px] bg-[var(--color-neutral-white)] py-1.5 pr-4 pl-2 text-left text-sm text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.1)] transition-colors hover:bg-[var(--color-neutral-off-white)] motion-reduce:transition-none",
                    focusRing,
                  )}
                >
                  <span className="shrink-0 rounded-full bg-[var(--color-semantic-warning-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-semantic-warning-text)]">
                    Flagged
                  </span>
                  <span className="min-w-0 text-pretty">
                    {funnel.label} · {previous ? `${previous.label} → ` : ""}
                    {stage.label}
                    {stage.flagReason ? `: ${stage.flagReason}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-pretty text-[var(--color-text-secondary)]">
          Flags compare the last 30 days with the 30 before, whatever range is
          selected.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto min-h-[50px] w-full sm:w-auto sm:self-start">
          {funnels.map((funnel) => {
            const flagged = funnel.stages.some((s) => s.flagged);
            return (
              <TabsTrigger
                key={funnel.key}
                value={funnel.key}
                className="min-h-11 flex-1 gap-2 px-4 text-sm sm:flex-none"
              >
                {funnel.label}
                {flagged && (
                  <>
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full bg-[var(--status-warn)]"
                    />
                    <span className="sr-only">(flagged)</span>
                  </>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {funnels.map((funnel) => (
          <TabsContent
            key={funnel.key}
            value={funnel.key}
            className="@container pt-5"
          >
            <FunnelSteps funnel={funnel} />
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-xs text-pretty text-[var(--color-text-secondary)]">
        Each bar is a share of the first step. The pale bar behind it is the
        step before, so the gap between them is who dropped off. The number in a
        bar is the share of the step before that moved on. Recent sign-ups may
        still move on.
      </p>
    </div>
  );
}

/**
 * The change part of a flag reason. Flags start with the step's percent ("12%, down 7 pts on
 * the previous 30 days"), which the step already shows, so only the change is kept. Other
 * reasons, such as wait times, pass through unchanged.
 */
export function flagChange(reason: string): string {
  const rest = reason.replace(/^\d+(\.\d+)?%,\s*/, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Height (or width) of a bar as a percentage of the first step, never so small it disappears. */
function share(count: number, first: number) {
  if (first <= 0) return 0;
  return Math.max((count / first) * 100, count > 0 ? 2 : 0);
}

/**
 * Wide card: one column per step, bars rising from a shared baseline, so the drop between
 * neighbours reads at a glance. Narrow card: the same steps as rows with full-width tracks.
 */
function FunnelSteps({ funnel }: { funnel: Funnel }) {
  const first = funnel.stages[0]?.count ?? 0;
  return (
    <ol
      aria-label={`${funnel.label} steps`}
      className="grid gap-5 @2xl:auto-cols-fr @2xl:grid-flow-col @2xl:gap-3"
    >
      {funnel.stages.map((stage, i) => (
        <Step
          key={stage.key}
          stage={stage}
          index={i}
          first={first}
          previous={funnel.stages[i - 1] ?? null}
        />
      ))}
    </ol>
  );
}

function Step({
  stage,
  index,
  first,
  previous,
}: {
  stage: Stage;
  index: number;
  first: number;
  previous: Stage | null;
}) {
  const bar = share(stage.count, first);
  const ghost = previous ? share(previous.count, first) : bar;
  const dropped = previous ? Math.max(previous.count - stage.count, 0) : 0;
  const fill = stage.flagged ? "var(--status-warn)" : "var(--chart-1)";

  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-baseline justify-between gap-3 @2xl:flex-col @2xl:items-start @2xl:gap-1">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--color-neutral-charcoal)]">
          <span className="text-[var(--color-text-secondary)] tabular-nums">
            {index + 1}.
          </span>
          <span className="truncate">{stage.label}</span>
          {stage.flagged && (
            <span className="shrink-0 rounded-full bg-[var(--color-semantic-warning-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--color-semantic-warning-text)]">
              Flagged
            </span>
          )}
        </span>
        <span className="shrink-0 text-xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] tabular-nums @2xl:text-2xl">
          {formatMetric(stage.count, "count")}
        </span>
      </div>

      {/* Narrow: a horizontal track. */}
      <div
        aria-hidden="true"
        className="relative h-3 overflow-hidden rounded-full bg-[var(--color-surface-subtle)] @2xl:hidden"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-secondary-sky)]"
          style={{ width: `${ghost}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${bar}%`, backgroundColor: fill }}
        />
      </div>

      {/* Wide: a column rising from a shared baseline, its headline figure split by the bar edge. */}
      <div
        aria-hidden="true"
        className="[container-type:inline-size] relative hidden h-48 overflow-hidden rounded-[12px] bg-[var(--color-surface-subtle)] @2xl:block"
      >
        <div
          className="absolute inset-x-0 bottom-0 rounded-t-[12px] bg-[var(--color-secondary-sky)]"
          style={{ height: `${ghost}%` }}
        />
        <div
          className="absolute inset-x-0 bottom-0 rounded-t-[12px]"
          style={{
            height: `${bar}%`,
            // Darkens within its own hue (blue or amber), with a hairline highlight on the top edge.
            backgroundImage: `linear-gradient(180deg, ${fill}, color-mix(in oklab, ${fill} 84%, black))`,
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.28)",
          }}
        />
        <SplitFigure
          bar={bar}
          color={fill}
          value={previous ? stage.conversion : stage.count}
          percent={previous !== null}
        />
      </div>

      {previous ? (
        <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums @2xl:flex-col">
          {/* Wide cards show this figure inside the bar, so the text stays for screen readers only. */}
          <div className="flex gap-1 @2xl:sr-only">
            <dt className="sr-only">Moved on</dt>
            <dd
              className={cn(
                "font-semibold",
                stage.flagged
                  ? "text-[var(--color-semantic-warning-text)]"
                  : "text-[var(--color-neutral-charcoal)]",
              )}
            >
              {formatMetric(stage.conversion, "percent")}
              <span className="font-normal text-[var(--color-text-secondary)]">
                {" "}
                moved on
              </span>
            </dd>
          </div>
          <div className="flex gap-1 text-[var(--color-text-secondary)]">
            <dt className="sr-only">Dropped off</dt>
            <dd>{formatMetric(dropped, "count")} dropped</dd>
          </div>
          {stage.medianDays !== null && (
            <div className="flex gap-1 text-[var(--color-text-secondary)]">
              <dt className="sr-only">Median wait</dt>
              <dd>{formatMetric(stage.medianDays, "days")} median wait</dd>
            </div>
          )}
          {stage.flagReason && (
            <div className="text-xs text-pretty text-[var(--color-semantic-warning-text)] @2xl:mt-1">
              <dt className="sr-only">Why it is flagged</dt>
              <dd>{flagChange(stage.flagReason)}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Where this funnel starts.
        </p>
      )}
    </li>
  );
}

/** Big figures stay readable: 12,480 becomes "12.5K". */
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * The column's headline figure, centred on the bar's top edge. It is drawn twice: in the bar
 * colour over the empty track, and in white clipped to the bar, so the digits change colour
 * exactly where the bar ends. Clamped so it never leaves the column.
 */
function SplitFigure({
  bar,
  color,
  value,
  percent,
}: {
  bar: number;
  color: string;
  value: number | null;
  percent: boolean;
}) {
  if (value === null) return null;
  const digits = percent
    ? String(Math.round(value * 100))
    : value >= 10_000
      ? compact.format(value)
      : formatMetric(value, "count");
  const centre = Math.min(Math.max(100 - bar, 26), 80);
  const figure = (tone: string) => (
    <span
      className="absolute left-5 flex -translate-y-1/2 items-start text-[clamp(2.25rem,24cqi,3.5rem)] leading-none font-semibold tracking-[-0.045em] tabular-nums"
      style={{ top: `${centre}%`, color: tone }}
    >
      {digits}
      {percent && (
        <span className="mt-[0.3em] ml-1 text-[0.45em] font-medium tracking-normal">
          %
        </span>
      )}
    </span>
  );
  return (
    <>
      {figure(color)}
      <span
        className="absolute inset-0"
        style={{ clipPath: `inset(${100 - bar}% 0 0 0)` }}
      >
        {figure("var(--color-neutral-white)")}
      </span>
    </>
  );
}
