"use client";

import Link from "next/link";
import { Popover } from "radix-ui";
import { Info } from "lucide-react";
import type { CatalogItem } from "@/lib/admin-dashboard";
import { cn } from "@/lib/utils";
import { card, focusRing } from "@/components/profile/styles";
import { PendingLabel } from "@/components/ui/pending-label";
import { Skeleton } from "@/components/ui/skeleton";
import { enterClass, enterStyle } from "@/components/motion/enter";

export type WidgetState = "loading" | "ready" | "error";

// Span 3 is a quarter on wide screens and a half on medium; span 6 is a half from lg.
const SPAN: Record<CatalogItem["span"], string> = {
  3: "md:col-span-6 xl:col-span-3",
  6: "lg:col-span-6",
  12: "",
};

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

/**
 * One dashboard widget: a titled card with a definition popover and an "Open" link.
 * `state` is "error" only when there is no data at all. A failed refresh keeps the old data
 * (`stale`) and says when it was taken.
 */
export function WidgetCard({
  item,
  state,
  index,
  stale = false,
  updatedAt,
  retrying = false,
  onRetry,
  children,
}: {
  item: CatalogItem;
  state: WidgetState;
  index: number;
  stale?: boolean;
  updatedAt?: number;
  retrying?: boolean;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  const titleId = `widget-${item.id}-title`;
  const retry = onRetry && (
    <button
      type="button"
      onClick={onRetry}
      disabled={retrying}
      aria-busy={retrying}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-[var(--color-primary-core)] hover:bg-[var(--color-secondary-sky)] disabled:opacity-60",
        focusRing,
      )}
    >
      <PendingLabel pending={retrying}>Try again</PendingLabel>
    </button>
  );

  return (
    <li
      id={`widget-${item.id}`}
      data-widget-id={item.id}
      data-state={state}
      className={cn(
        "relative col-span-12 scroll-mt-[calc(var(--dash-sticky,3.5rem)+1rem)]",
        SPAN[item.span],
      )}
    >
      <section
        data-widget-card
        tabIndex={-1}
        aria-labelledby={titleId}
        className={cn(
          card,
          "h-full p-5 outline-none focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-primary-core)] sm:p-6",
          enterClass,
        )}
        style={enterStyle(index)}
      >
        <header className="flex min-h-11 items-center justify-between gap-3">
          <h2
            id={titleId}
            className="min-w-0 text-base font-semibold text-balance text-[var(--color-neutral-charcoal)]"
          >
            {item.title}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  aria-label={`How ${item.title} is measured`}
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-off-white)]",
                    focusRing,
                  )}
                >
                  <Info aria-hidden className="size-4" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="bottom"
                  align="end"
                  sideOffset={6}
                  collisionPadding={12}
                  className="z-50 max-w-72 rounded-[16px] bg-[var(--color-neutral-white)] p-4 text-sm text-pretty text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_16px_36px_-12px_rgb(0_0_0/0.18)] outline-none"
                >
                  {item.definition}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            {item.href && (
              <Link
                href={item.href}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-[var(--color-primary-core)] hover:bg-[var(--color-secondary-sky)]",
                  focusRing,
                )}
              >
                Open
                <span className="sr-only"> {item.title}</span>
              </Link>
            )}
          </div>
        </header>

        <div className="mt-4">
          {state === "loading" && <WidgetSkeleton kind={item.kind} />}
          {state === "error" && (
            <div className="flex flex-col items-start gap-2 py-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Couldn&apos;t load this.
              </p>
              {retry}
            </div>
          )}
          {state === "ready" && children}
        </div>

        {state === "ready" && stale && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 text-xs text-[var(--color-text-secondary)]">
            <span>
              Couldn&apos;t refresh. Showing data from{" "}
              {updatedAt ? TIME.format(updatedAt) : "earlier"}.
            </span>
            {retry}
          </div>
        )}
      </section>
    </li>
  );
}

/** Shapes match each renderer's real height, so the card does not jump when data arrives. */
function WidgetSkeleton({ kind }: { kind: CatalogItem["kind"] }) {
  switch (kind) {
    case "kpi":
      return (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    case "series":
      return <Skeleton aria-hidden="true" className="h-[240px] w-full" />;
    case "donut":
      return (
        <div
          aria-hidden="true"
          className="flex flex-col items-center gap-6 sm:flex-row"
        >
          <Skeleton className="size-[200px] shrink-0 rounded-full" />
          <div className="grid w-full gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
      );
    case "funnel":
      return (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-11 w-full rounded-full" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      );
    case "queue":
      return (
        <div aria-hidden="true" className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      );
  }
}
