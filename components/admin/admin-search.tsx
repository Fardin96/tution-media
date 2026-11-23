"use client";

import {
  useEffect,
  useId,
  useRef,
  type RefObject,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducedMotion, type Transition } from "motion/react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/animate-ui/primitives/radix/dialog";
import {
  MAX_WIDGETS,
  dashboardLayoutQueryOptions,
  useAddDashboardWidget,
  type WidgetId,
} from "@/lib/admin-dashboard";
import {
  DASHBOARD_HREF,
  PEOPLE_MIN_CHARS,
  ROLE_LABEL,
  SEARCH_DEBOUNCE_MS,
  buildSections,
  isSearchShortcut,
  pageEntries,
  usePeopleSearch,
  viewEntries,
  widgetEntries,
  type NavPage,
  type PaletteOption,
  type PaletteSection,
  type PeopleState,
} from "@/lib/admin-search";
import { cn } from "@/lib/utils";
import { control } from "@/components/profile/profile-fields";
import { jumpToWidget } from "./dashboard/jump";
import type { Range } from "@/lib/fuzzy";

// Radix dialogs don't set aria-modal, so match the open state instead.
const DIALOG_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';
const FULL_MESSAGE = "Your dashboard is full. Remove a widget in Customize.";

type WidgetOption = Extract<PaletteOption, { kind: "widget" }>;

const noopSubscribe = () => () => {};

function isMacPlatform() {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /mac|iphone|ipad/i.test(platform);
}

/** "⌘K" on Mac, "Ctrl K" elsewhere. Null on the server and in the hydration pass, so no wrong platform flashes. */
export function useShortcutLabel(): string | null {
  const mac = useSyncExternalStore(noopSubscribe, isMacPlatform, () => null);
  return mac === null ? null : mac ? "⌘K" : "Ctrl K";
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * The admin command palette. It owns the Ctrl+K / Cmd+K shortcut (and closes the palette with
 * it while open), and mounts once in the admin shell so every admin page has it.
 */
/** The palette only fades: opacity over ~120 ms, and no motion at all under reduced motion. */
function paletteFade(reduce: boolean | null) {
  const transition: Transition = reduce
    ? { duration: 0 }
    : { duration: 0.12, ease: "easeOut" };
  return {
    initial: reduce ? false : { opacity: 0 },
    animate: { opacity: 1, transition },
    exit: { opacity: 0, transition },
  };
}

export function AdminSearch({
  open,
  onOpenChange,
  pages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: readonly NavPage[];
}) {
  const [announcement, setAnnouncement] = useState("");
  const reduceMotion = useReducedMotion();
  // Set when a pick hands focus to the page itself, so the dialog's return-focus doesn't steal it.
  const skipReturnFocusRef = useRef(false);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!isSearchShortcut(e)) return;
      if (open) {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (document.querySelector(DIALOG_SELECTOR)) return;
      e.preventDefault();
      onOpenChange(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay
            className="fixed inset-0 z-50 bg-black/40"
            {...paletteFade(reduceMotion)}
          />
          <DialogContent
            {...paletteFade(reduceMotion)}
            onCloseAutoFocus={(event) => {
              if (!skipReturnFocusRef.current) return;
              event.preventDefault();
              skipReturnFocusRef.current = false;
            }}
            className="fixed start-1/2 top-4 z-50 flex max-h-[80dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-[24px] bg-[var(--color-neutral-white)] p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.08)] focus:outline-none sm:top-[12vh] rtl:translate-x-1/2"
          >
            <DialogTitle className="sr-only">Search admin</DialogTitle>
            <DialogDescription className="sr-only">
              Find a page, a view, a person or a dashboard widget.
            </DialogDescription>
            <PaletteBody
              pages={pages}
              open={open}
              announcement={announcement}
              announce={setAnnouncement}
              skipReturnFocusRef={skipReturnFocusRef}
              onClose={() => onOpenChange(false)}
            />
          </DialogContent>
        </DialogPortal>
      </Dialog>
      {/* Radix hides everything outside the open dialog, so this only speaks once the palette has closed. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}

/**
 * The palette's content. It mounts with the dialog and unmounts after the exit, so each open
 * starts with an empty query.
 */
function PaletteBody({
  pages,
  open,
  announcement,
  announce,
  skipReturnFocusRef,
  onClose,
}: {
  pages: readonly NavPage[];
  open: boolean;
  announcement: string;
  announce: (message: string) => void;
  skipReturnFocusRef: RefObject<boolean>;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const addWidget = useAddDashboardWidget();
  const listId = useId();
  const busy = useRef(false);

  const [query, setQuery] = useState("");
  // Null until the user moves; then the best-scoring option is active.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // A message from the last open or pick must not show as this open's status.
  useEffect(() => {
    announce("");
  }, [announce]);

  const trimmed = query.trim();
  const debounced = useDebounced(trimmed, SEARCH_DEBOUNCE_MS);
  const layout = useQuery({ ...dashboardLayoutQueryOptions(), enabled: open });
  const people = usePeopleSearch(
    debounced,
    open && debounced.length >= PEOPLE_MIN_CHARS,
  );

  // Rows only show for the query on screen: a pending or older answer reads as "Searching people…".
  const peopleState: PeopleState =
    trimmed.length < PEOPLE_MIN_CHARS
      ? { status: "idle" }
      : debounced !== trimmed || people.isPlaceholderData || people.isPending
        ? { status: "searching" }
        : people.isError
          ? { status: "error" }
          : { status: "ready", accounts: people.data ?? [] };

  const sections: PaletteSection[] = buildSections({
    query: trimmed,
    pages: pageEntries(pages),
    views: viewEntries(),
    widgets: layout.data ? widgetEntries(layout.data) : null,
    people: peopleState,
    dashboardFull: (layout.data?.widgets.length ?? 0) >= MAX_WIDGETS,
  });

  const flat = sections.flatMap((section) => section.options);
  const count = flat.length;
  const indexOf = new Map(flat.map((option, i) => [option.key, i]));
  // Sections are in display order, but the default pick is the strongest match overall (ties keep the first).
  const bestKey =
    flat.reduce<PaletteOption | null>(
      (best, option) => (!best || option.score > best.score ? option : best),
      null,
    )?.key ?? null;
  const currentKey =
    activeKey !== null && indexOf.has(activeKey) ? activeKey : bestKey;
  const activeIndex =
    currentKey === null ? -1 : (indexOf.get(currentKey) ?? -1);
  const activeId =
    activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined;

  useEffect(() => {
    if (activeId) {
      document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeId]);

  async function jump(id: WidgetId) {
    const found = await jumpToWidget(id, {
      reducedMotion: !!reduceMotion,
      announce,
    });
    // A newer jump that took over announces for itself; only report a widget that is really missing.
    if (!found && !document.getElementById(`widget-${id}`)) {
      announce("That widget isn't on the page.");
    }
  }

  function go(href: string) {
    skipReturnFocusRef.current = false;
    onClose();
    router.push(href);
  }

  async function pickWidget(option: WidgetOption) {
    if (busy.current) return;
    const onPage = pathname === DASHBOARD_HREF;

    if (option.onDashboard) {
      skipReturnFocusRef.current = true;
      onClose();
      if (onPage) await jump(option.id);
      else router.push(`${DASHBOARD_HREF}?focus=${option.id}`);
      return;
    }

    if (option.blocked) {
      announce(FULL_MESSAGE);
      return;
    }

    busy.current = true;
    setAdding(true);
    announce(`Adding ${option.title}…`);
    let added = false;
    try {
      // The add reads the saved layout from the cache, so make sure it is there.
      await queryClient.fetchQuery(dashboardLayoutQueryOptions());
      await addWidget.mutateAsync(option.id);
      added = true;
    } catch {
      // The hook shows the error toast; the palette stays open, so say it here too.
      announce("Couldn't add that widget.");
    } finally {
      busy.current = false;
      setAdding(false);
    }
    if (!added) return;

    skipReturnFocusRef.current = true;
    onClose();
    if (onPage) await jump(option.id);
    else router.push(`${DASHBOARD_HREF}?focus=${option.id}`);
  }

  function pick(option: PaletteOption) {
    if (option.kind === "widget") void pickWidget(option);
    else go(option.href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // While a widget is being added, keys do nothing: focus stays in the input.
    if (adding) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (count === 0) return;
      e.preventDefault();
      const from = activeIndex < 0 ? 0 : activeIndex;
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next = flat[(from + step + count) % count];
      if (next) setActiveKey(next.key);
      return;
    }
    if ((e.key === "Home" || e.key === "End") && count > 0) {
      e.preventDefault();
      const next = flat[e.key === "Home" ? 0 : count - 1];
      if (next) setActiveKey(next.key);
      return;
    }
    if (e.key === "Enter" && activeIndex >= 0) {
      const option = flat[activeIndex];
      if (!option) return;
      e.preventDefault();
      pick(option);
    }
  }

  // The one status message for the palette. People state folds in here, since the rows that
  // show it are hidden from assistive tech.
  const message =
    trimmed === ""
      ? ""
      : peopleState.status === "error"
        ? "Couldn't search people."
        : peopleState.status === "searching"
          ? "Searching people…"
          : count > 0
            ? `${count} ${count === 1 ? "result" : "results"}`
            : "No results";
  const statusRows = sections.flatMap((section) =>
    section.status ? [section.status] : [],
  );

  return (
    <>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-[var(--color-neutral-gray)]"
        />
        <input
          type="text"
          role="combobox"
          aria-label="Search admin"
          placeholder="Search pages, people, views and widgets"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={sections.length > 0}
          aria-controls={sections.length > 0 ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveKey(null);
            announce("");
          }}
          onKeyDown={onKeyDown}
          readOnly={adding}
          aria-disabled={adding || undefined}
          aria-busy={adding || undefined}
          className={cn(
            control,
            "min-h-12 rounded-full ps-11 pe-4 text-base shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:text-sm",
          )}
        />
      </div>
      <div role="status" className="sr-only">
        {announcement || message}
      </div>

      {sections.length > 0 ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {sections.map((section) => (
            <div
              key={section.id}
              role="group"
              aria-labelledby={`${listId}-${section.id}`}
              className="grid gap-0.5 pb-2"
            >
              <p
                id={`${listId}-${section.id}`}
                className="px-3 pt-2 pb-1 text-xs font-semibold text-[var(--color-text-secondary)]"
              >
                {section.label}
              </p>
              {section.options.map((option) => {
                const i = indexOf.get(option.key) ?? -1;
                return (
                  <OptionRow
                    key={option.key}
                    id={`${listId}-opt-${i}`}
                    option={option}
                    selected={i === activeIndex}
                    onHover={() => setActiveKey(option.key)}
                    onPick={() => pick(option)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ) : trimmed !== "" && peopleState.status !== "searching" ? (
        <p className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">
          No matches for “{trimmed}”.
        </p>
      ) : null}
      {statusRows.map((text) => (
        <p
          key={text}
          aria-hidden="true"
          className="px-3 py-2 text-sm text-[var(--color-text-secondary)]"
        >
          {text}
        </p>
      ))}
    </>
  );
}

function OptionRow({
  id,
  option,
  selected,
  onHover,
  onPick,
}: {
  id: string;
  option: PaletteOption;
  selected: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const blocked = option.kind === "widget" && option.blocked;
  const ranges: Range[] = option.kind === "person" ? [] : option.ranges;
  const right =
    option.kind === "person" ? (
      <span className="shrink-0 rounded-full bg-[var(--color-secondary-sky)] px-2 py-0.5 text-xs font-semibold text-[var(--color-primary-deep)]">
        {ROLE_LABEL[option.role]}
      </span>
    ) : option.kind === "widget" ? (
      <span className="shrink-0 text-xs font-semibold text-[var(--color-primary-core)]">
        {option.blocked
          ? "Dashboard is full"
          : option.onDashboard
            ? "Jump to"
            : "Add and jump"}
      </span>
    ) : null;

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={blocked || undefined}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className={cn(
        "mx-1 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-sm text-[var(--color-neutral-charcoal)]",
        selected && "bg-[var(--color-neutral-off-white)]",
        blocked && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">
          <Highlighted text={option.title} ranges={ranges} />
        </span>
        {option.subtitle ? (
          <span className="block truncate text-xs text-[var(--color-text-secondary)]">
            {option.subtitle}
          </span>
        ) : null}
      </span>
      {right}
    </div>
  );
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
