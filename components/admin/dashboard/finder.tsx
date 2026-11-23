"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { Search } from "lucide-react";
import {
  GROUP_LABEL,
  MAX_WIDGETS,
  useAddDashboardWidget,
  type CatalogItem,
  type DashboardLayout,
  type WidgetId,
} from "@/lib/admin-dashboard";
import { searchEntries, type Range } from "@/lib/fuzzy";
import { cn } from "@/lib/utils";
import { control } from "@/components/profile/profile-fields";
import { ADMIN_NAV } from "@/components/admin/admin-shell";
import { jumpToWidget } from "./jump";

type Entry =
  | {
      kind: "widget";
      key: string;
      id: WidgetId;
      title: string;
      extra: string[];
      onDashboard: boolean;
    }
  | {
      kind: "page";
      key: string;
      href: string;
      title: string;
      extra: string[];
    };

const MAX_RESULTS = 8;
// Radix dialogs don't set aria-modal, so match the open state instead.
const DIALOG_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

function buildEntries(layout: DashboardLayout): Entry[] {
  const onDashboard = new Set<WidgetId>(layout.widgets);
  const widgets: Entry[] = layout.catalog.map((item: CatalogItem) => ({
    kind: "widget",
    key: `widget:${item.id}`,
    id: item.id,
    title: item.title,
    extra: [
      item.description,
      item.definition,
      GROUP_LABEL[item.group],
      ...item.keywords,
    ],
    onDashboard: onDashboard.has(item.id),
  }));
  const pages: Entry[] = ADMIN_NAV.filter(
    (item) => item.href !== "/dashboard/admin",
  ).map((item) => ({
    kind: "page",
    key: `page:${item.href}`,
    href: item.href,
    title: item.label,
    extra: [item.description],
  }));
  return [...widgets, ...pages];
}

const noopSubscribe = () => () => {};

function isMacPlatform() {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /mac|iphone|ipad/i.test(platform);
}

function Highlighted({ text, ranges }: { text: string; ranges: Range[] }) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={i}
        className="bg-transparent font-semibold text-[var(--color-primary-core)]"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function DashboardFinder({ layout }: { layout: DashboardLayout }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const addWidget = useAddDashboardWidget();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  // Null on the server and in the hydration pass, so the shortcut never flashes the wrong platform.
  const mac = useSyncExternalStore(noopSubscribe, isMacPlatform, () => null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      if (e.altKey || e.shiftKey) return;
      if (document.querySelector(DIALOG_SELECTOR)) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const entries = useMemo(() => buildEntries(layout), [layout]);
  const results = useMemo(
    () =>
      searchEntries(
        query,
        entries,
        (e) => ({
          title: e.title,
          extra: e.extra,
        }),
        MAX_RESULTS,
      ),
    [query, entries],
  );

  const hasQuery = query.trim() !== "";
  const showList = open && hasQuery;
  const count = results.length;
  const activeIndex = count === 0 ? -1 : Math.min(active, count - 1);
  const optionId = (i: number) => `${listId}-opt-${i}`;

  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView?.({ block: "nearest" });
    // optionId is derived from listId, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, listId]);

  const announce = (msg: string) => setAnnouncement(msg);

  function reset() {
    setQuery("");
    setOpen(false);
    setActive(0);
  }

  async function jump(id: WidgetId) {
    const found = await jumpToWidget(id, {
      reducedMotion: !!reduceMotion,
      announce,
    });
    // A newer jump that took over has its own announcement; only report a widget that is really missing.
    if (!found && !document.getElementById(`widget-${id}`)) {
      announce("That widget isn't on the page.");
    }
  }

  async function pick(entry: Entry) {
    if (entry.kind === "page") {
      reset();
      router.push(entry.href);
      return;
    }

    if (entry.onDashboard) {
      reset();
      await jump(entry.id);
      return;
    }

    if (busy.current) return;
    if (layout.widgets.length >= MAX_WIDGETS) {
      announce("Your dashboard is full. Remove a widget in Customize.");
      return;
    }
    busy.current = true;
    setAdding(true);
    reset();
    announce(`Adding ${entry.title}…`);
    try {
      await addWidget.mutateAsync(entry.id);
      await jump(entry.id);
    } catch {
      // The hook shows the error toast; nothing to jump to.
    } finally {
      busy.current = false;
      setAdding(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (count === 0) return;
      e.preventDefault();
      setOpen(true);
      const from = activeIndex < 0 ? 0 : activeIndex;
      const next =
        e.key === "ArrowDown" ? (from + 1) % count : (from - 1 + count) % count;
      setActive(next);
      return;
    }
    if (e.key === "Home" && showList && count > 0) {
      e.preventDefault();
      setActive(0);
      return;
    }
    if (e.key === "End" && showList && count > 0) {
      e.preventDefault();
      setActive(count - 1);
      return;
    }
    if (e.key === "Enter") {
      if (showList && activeIndex >= 0) {
        e.preventDefault();
        void pick(results[activeIndex].entry);
      }
      return;
    }
    if (e.key === "Escape") {
      if (showList) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      } else if (hasQuery) {
        e.preventDefault();
        e.stopPropagation();
        setQuery("");
        setActive(0);
      }
    }
  }

  const shortcut = mac === null ? null : mac ? "⌘K" : "Ctrl K";

  return (
    <div data-dashboard-finder className="relative w-full min-w-0">
      <Search
        aria-hidden
        className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-[var(--color-neutral-gray)]"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Find a widget or page"
        placeholder="Find a widget or page"
        autoComplete="off"
        spellCheck={false}
        aria-expanded={showList && count > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeIndex >= 0 ? optionId(activeIndex) : undefined
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        disabled={adding}
        aria-busy={adding || undefined}
        className={cn(
          control,
          "min-h-11 rounded-full ps-11 pe-16 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        )}
      />
      {shortcut && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--color-border-control)] px-1.5 py-0.5 font-sans text-xs text-[var(--color-text-secondary)] sm:inline-block"
        >
          {shortcut}
        </kbd>
      )}

      {showList ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-[16px] bg-[var(--color-neutral-white)] p-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.08)]">
          {count > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Matches"
              className="grid gap-0.5"
            >
              {results.map(({ entry, ranges }, i) => {
                const blocked =
                  entry.kind === "widget" &&
                  !entry.onDashboard &&
                  layout.widgets.length >= MAX_WIDGETS;
                const action =
                  entry.kind === "page"
                    ? "Open"
                    : entry.onDashboard
                      ? "Jump to"
                      : blocked
                        ? "Dashboard is full"
                        : "Add and jump";
                const tag =
                  entry.kind === "page"
                    ? "Page"
                    : entry.onDashboard
                      ? "On your dashboard"
                      : "Not on your dashboard";
                const isActive = i === activeIndex;
                return (
                  <li
                    key={entry.key}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isActive}
                    aria-disabled={blocked || undefined}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void pick(entry)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-sm text-[var(--color-neutral-charcoal)]",
                      isActive && "bg-[var(--color-neutral-off-white)]",
                      blocked && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        <Highlighted text={entry.title} ranges={ranges} />
                      </span>
                      <span className="block text-xs text-[var(--color-text-secondary)]">
                        {tag}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[var(--color-primary-core)]">
                      {action}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              No matches
            </p>
          )}
        </div>
      ) : null}

      <div role="status" aria-live="polite" className="sr-only">
        {hasQuery && open
          ? count > 0
            ? `${count} results`
            : "No results"
          : ""}
      </div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
