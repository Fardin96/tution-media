"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useIsFetching } from "@tanstack/react-query";
import { useReducedMotion } from "motion/react";
import {
  DASHBOARD_SKELETON,
  DEFAULT_RANGE,
  RANGES,
  parseRange,
  useDashboardLayout,
  useDashboardWidget,
  type CatalogItem,
  type DashboardRange,
} from "@/lib/admin-dashboard";
import { useAdminMe } from "@/lib/admin";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { card, focusRing, secondaryButton } from "@/components/profile/styles";
import { AdminPage } from "@/components/admin/admin-ui";
import { PendingLabel } from "@/components/ui/pending-label";
import { Skeleton } from "@/components/ui/skeleton";
import { overRange } from "./format";
import { CustomizeSheet } from "./customize-sheet";
import { WidgetBody } from "./widget-body";
import { WidgetCard } from "./widget-card";
import { jumpToWidget } from "./jump";

const STICKY_BELOW_LG = "3.5rem";
const DESKTOP = "(min-width: 1024px)";

/** The admin home: range and customise above a grid of widgets. Search lives in the admin shell. */
export function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = parseRange(searchParams.get("range"));
  const me = useAdminMe();
  const layout = useDashboardLayout();
  const [customizing, setCustomizing] = useState(false);
  const reduceMotion = useReducedMotion();
  const [jumpNote, setJumpNote] = useState("");

  // ?focus=<id> comes from the command palette: jump to that widget once, then drop the param.
  const focus = searchParams.get("focus");
  const handledFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!focus || !layout.data) return;
    if (handledFocus.current === focus) return;
    handledFocus.current = focus;
    if (layout.data.widgets.some((id) => id === focus)) {
      void jumpToWidget(focus, {
        reducedMotion: !!reduceMotion,
        announce: setJumpNote,
      });
    } else {
      // Set from a callback, like the jump's own announcements, not synchronously in the effect.
      void Promise.resolve().then(() =>
        setJumpNote("That widget isn't on the page."),
      );
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("focus");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [focus, layout.data, reduceMotion, searchParams, router, pathname]);

  const catalog = layout.data?.catalog ?? [];
  const items = (layout.data?.widgets ?? []).flatMap((id): CatalogItem[] => {
    const item = catalog.find((c) => c.id === id);
    return item ? [item] : [];
  });
  const fetching = useIsFetching({
    queryKey: queryKeys.admin.dashboard.widgetsAll,
  });
  const loading = layout.isPending || fetching > 0;
  const message = useLiveMessage(loading, range);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const sticky = useStickyOffset(toolbarRef, !layout.isPending);

  function selectRange(next: DashboardRange) {
    if (next === range) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_RANGE) params.delete("range");
    else params.set("range", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  const firstName = me.adminUser?.name.split(" ")[0];

  if (layout.isPending) {
    return (
      <>
        <p role="status" className="sr-only">
          {message}
        </p>
        <DashboardSkeleton />
      </>
    );
  }

  return (
    <div style={{ "--dash-sticky": sticky } as CSSProperties}>
      <AdminPage
        title="Dashboard"
        description={firstName ? `Hi, ${firstName}.` : undefined}
      >
        <p role="status" className="sr-only">
          {message}
        </p>
        <p aria-live="polite" className="sr-only">
          {jumpNote}
        </p>

        <div
          id="dashboard-toolbar"
          ref={toolbarRef}
          className="z-20 flex flex-wrap items-center gap-3 bg-[var(--color-neutral-off-white)] py-3 lg:sticky lg:top-0"
        >
          <RangeControl value={range} onChange={selectRange} />
          <button
            type="button"
            onClick={() => setCustomizing(true)}
            disabled={!layout.data}
            className={cn(secondaryButton, "ms-auto shrink-0")}
          >
            Customize
          </button>
        </div>

        {layout.isPending && <GridSkeleton />}
        {layout.isError && !layout.data && (
          <div
            className={cn(card, "flex flex-col items-start gap-3 p-5 sm:p-6")}
          >
            <p className="text-sm text-[var(--color-text-secondary)]">
              Couldn&apos;t load the dashboard.
            </p>
            <button
              type="button"
              onClick={() => void layout.refetch()}
              disabled={layout.isFetching}
              aria-busy={layout.isFetching}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full bg-[var(--color-primary-core)] px-5 text-sm font-semibold text-[var(--color-neutral-white)] disabled:opacity-60",
                focusRing,
              )}
            >
              <PendingLabel pending={layout.isFetching}>Try again</PendingLabel>
            </button>
          </div>
        )}
        {layout.data && items.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No widgets yet. Use Customize to add some.
          </p>
        )}
        {layout.data && items.length > 0 && (
          <ul className="mt-6 grid grid-cols-12 gap-4">
            {items.map((item, i) => (
              <DashboardWidgetSlot
                key={item.id}
                item={item}
                range={range}
                index={i}
              />
            ))}
          </ul>
        )}
      </AdminPage>

      {layout.data && (
        <CustomizeSheet
          open={customizing}
          onOpenChange={setCustomizing}
          layout={layout.data}
        />
      )}
    </div>
  );
}

/** One widget's query. A range change keeps the previous data on screen until the new one lands. */
function DashboardWidgetSlot({
  item,
  range,
  index,
}: {
  item: CatalogItem;
  range: DashboardRange;
  index: number;
}) {
  const query = useDashboardWidget(item.id, range);
  const hasData = query.data !== undefined;
  const state = hasData ? "ready" : query.isError ? "error" : "loading";
  return (
    <WidgetCard
      item={item}
      index={index}
      state={state}
      stale={hasData && query.isError}
      updatedAt={query.dataUpdatedAt}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
    >
      {query.data && (
        <WidgetBody item={item} payload={query.data.data} range={range} />
      )}
    </WidgetCard>
  );
}

/**
 * One polite message for the page: "Loading dashboard…", then "Dashboard updated." once,
 * and "Showing data over …" when the range changes. State is adjusted during render, not in an
 * effect, so each change is announced once.
 */
function useLiveMessage(loading: boolean, range: DashboardRange) {
  const [seen, setSeen] = useState({ loading: false, range, text: "" });
  let current = seen;
  if (seen.loading !== loading || seen.range !== range) {
    const text =
      seen.range !== range
        ? `Showing data ${overRange(range)}.`
        : loading
          ? "Loading dashboard…"
          : seen.loading
            ? "Dashboard updated."
            : seen.text;
    current = { loading, range, text };
    setSeen(current);
  }
  return current.text;
}

/**
 * The sticky toolbar's offset for the widgets' scroll margin: 3.5rem below lg (the mobile top
 * bar), and the measured toolbar height from lg, where the toolbar sticks.
 */
function useStickyOffset(
  ref: RefObject<HTMLDivElement | null>,
  ready: boolean,
) {
  const [offset, setOffset] = useState(STICKY_BELOW_LG);

  useEffect(() => {
    const toolbar = ref.current;
    if (!toolbar || typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia(DESKTOP);
    const update = () =>
      setOffset(
        desktop.matches ? `${toolbar.offsetHeight}px` : STICKY_BELOW_LG,
      );
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(toolbar);
    desktop.addEventListener("change", update);
    return () => {
      observer?.disconnect();
      desktop.removeEventListener("change", update);
    };
    // ready: the toolbar mounts once the layout loads, after the skeleton.
  }, [ref, ready]);

  return offset;
}

function RangeControl({
  value,
  onChange,
}: {
  value: DashboardRange;
  onChange: (value: DashboardRange) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + RANGES.length) % RANGES.length;
    onChange(RANGES[next]!.value);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Date range"
      className="grid w-full grid-cols-[repeat(5,minmax(0,1fr))] gap-1 rounded-2xl bg-[var(--color-neutral-white)] p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.04)] sm:inline-flex sm:w-auto sm:shrink-0 sm:rounded-full"
    >
      {RANGES.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-label={option.label}
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, i)}
            className={cn(
              "min-h-11 min-w-0 rounded-[12px] px-2 text-center text-sm leading-tight font-semibold whitespace-normal transition-colors duration-150 ease-out motion-reduce:transition-none sm:rounded-full sm:px-4 sm:whitespace-nowrap lg:px-3 xl:px-4",
              focusRing,
              checked
                ? "bg-[var(--color-secondary-sky)] text-[var(--color-neutral-charcoal)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-neutral-charcoal)]",
            )}
          >
            <span className="sm:hidden">{option.short ?? option.label}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The page while the layout loads. The Suspense fallback in app/dashboard/admin uses it too, so the page does not change shape on hydration. */
export function DashboardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-64">
          <Skeleton className="h-8 w-56 max-w-full sm:h-9" />
          <Skeleton className="mt-2 h-4 w-48 max-w-full" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 py-3">
        <Skeleton className="h-11 w-full rounded-2xl sm:w-[27rem] sm:rounded-full" />
        <Skeleton className="ms-auto h-11 w-28 shrink-0 rounded-full" />
      </div>
      <GridSkeleton />
    </div>
  );
}

function GridSkeleton() {
  return (
    <ul aria-hidden="true" className="mt-6 grid grid-cols-12 gap-4">
      {DASHBOARD_SKELETON.map((slot, i) => (
        <li key={i} className={slot.span}>
          <div className={cn(card, "flex h-full flex-col gap-4 p-5 sm:p-6")}>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className={cn("w-full", slot.body)} />
          </div>
        </li>
      ))}
    </ul>
  );
}
