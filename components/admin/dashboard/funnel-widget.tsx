"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/profile/styles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FunnelPayload } from "@/lib/admin-dashboard";
import { formatMetric } from "./format";

type Funnel = FunnelPayload["funnels"][number];
type Stage = Funnel["stages"][number];

/** A funnel's stages as bars, with a "Stuck at" strip of every flagged stage above the tabs. */
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
    <div className="flex flex-col gap-4">
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
                    "inline-flex min-h-11 max-w-full items-center gap-2 rounded-full bg-[var(--color-neutral-white)] py-1.5 pr-4 pl-2 text-left text-sm text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.1)] hover:bg-[var(--color-neutral-off-white)]",
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
        <TabsList className="h-auto min-h-[50px] w-full sm:w-auto">
          {funnels.map((funnel) => (
            <TabsTrigger
              key={funnel.key}
              value={funnel.key}
              className="min-h-11 flex-1 px-4 text-sm sm:flex-none"
            >
              {funnel.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {funnels.map((funnel) => (
          <TabsContent key={funnel.key} value={funnel.key} className="pt-4">
            <FunnelStages funnel={funnel} />
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-xs text-pretty text-[var(--color-text-secondary)]">
        Recent sign-ups may still move to the next step.
      </p>
    </div>
  );
}

function FunnelStages({ funnel }: { funnel: Funnel }) {
  const first = funnel.stages[0]?.count ?? 0;
  return (
    <ol aria-label={`${funnel.label} stages`} className="flex flex-col gap-4">
      {funnel.stages.map((stage, i) => (
        <StageRow
          key={stage.key}
          stage={stage}
          ratio={first > 0 ? stage.count / first : 0}
          first={i === 0}
        />
      ))}
    </ol>
  );
}

function StageRow({
  stage,
  ratio,
  first,
}: {
  stage: Stage;
  ratio: number;
  first: boolean;
}) {
  return (
    <li className="grid gap-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--color-neutral-charcoal)]">
          {stage.label}
        </span>
        {stage.flagged && (
          <span className="rounded-full bg-[var(--color-semantic-warning-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--color-semantic-warning-text)]">
            Flagged
          </span>
        )}
      </div>
      <div
        aria-hidden="true"
        className="h-3 overflow-hidden rounded-full bg-[var(--color-neutral-off-white)]"
      >
        <div
          className="h-full min-w-1 rounded-full"
          style={{
            width: `${Math.min(ratio, 1) * 100}%`,
            backgroundColor: stage.flagged
              ? "var(--status-warn)"
              : "var(--chart-1)",
          }}
        />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm whitespace-nowrap tabular-nums">
        <span className="font-semibold text-[var(--color-neutral-charcoal)]">
          {formatMetric(stage.count, "count")}
        </span>
        {!first && (
          <span className="text-[var(--color-text-secondary)]">
            {`${formatMetric(stage.conversion, "percent")} of previous`}
          </span>
        )}
        {stage.medianDays !== null && (
          <span className="text-[var(--color-text-secondary)]">
            median {formatMetric(stage.medianDays, "days")}
          </span>
        )}
      </div>
    </li>
  );
}
