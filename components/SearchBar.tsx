"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { cn } from "@/lib/utils";
import {
  SuggestionPopup,
  optionId,
  type SuggestionRow,
} from "@/components/search-suggestions";
import { type AreaOption, loadAreas } from "@/lib/areas";
import type { Option } from "@/lib/profile";
import { loadSubjects } from "@/lib/subjects";
import {
  SEARCH_TEXT_MAX,
  placeLabel,
  suggestPlaces,
  suggestSubjects,
  type PlacePick,
} from "@/lib/tutor-search";
import { queryKeys } from "@/lib/query-keys";

// ponytail: sizes estimated from the design screenshot (Figma MCP was rate-limited); swap for exact specs.
const field = "flex min-h-12 flex-1 items-center gap-2 ps-4 pe-2";

const LOOKUP_STALE_MS = 30 * 60_000;
const LOOKUP_GC_MS = 60 * 60_000;
const SUGGESTION_LIMIT = 6;

type Lookups = { subjects: Option[]; areas: AreaOption[] };
const NO_LOOKUPS: Lookups = { subjects: [], areas: [] };

type SearchBarProps = {
  className?: string;
  skillPlaceholders: string[];
  placePlaceholders: string[];
  searchLabel: string;
};

/**
 * Fetches the subject and area lists. It is mounted only after the first focus, so nothing
 * is requested on page load and the server render needs no QueryClient. Both lookups fail
 * quietly: a failed list means no suggestions, and the next focus retries it.
 */
function LookupLoader({
  onLoaded,
  retryTick,
}: {
  onLoaded: (lookups: Lookups) => void;
  retryTick: number;
}) {
  const subjects = useQuery({
    queryKey: queryKeys.subjects,
    queryFn: loadSubjects,
    staleTime: LOOKUP_STALE_MS,
    gcTime: LOOKUP_GC_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const areas = useQuery({
    queryKey: queryKeys.areas,
    queryFn: loadAreas,
    staleTime: LOOKUP_STALE_MS,
    gcTime: LOOKUP_GC_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    onLoaded({
      subjects: subjects.data ?? NO_LOOKUPS.subjects,
      areas: areas.data ?? NO_LOOKUPS.areas,
    });
  }, [subjects.data, areas.data, onLoaded]);

  // Each focus retries a list that failed. Runs only when the tick moves, not on every render.
  const handled = useRef(retryTick);
  useEffect(() => {
    if (handled.current === retryTick) return;
    handled.current = retryTick;
    if (subjects.isError) void subjects.refetch();
    if (areas.isError) void areas.refetch();
  }, [retryTick, subjects, areas]);

  return null;
}

type Item = { row: SuggestionRow; choose: () => void };

type SuggestFieldProps = {
  className: string;
  icon: ReactNode;
  name: string;
  type?: "text" | "search";
  label: string;
  listLabel: string;
  placeholders: string[];
  autoComplete?: string;
  text: string;
  onText: (text: string) => void;
  items: Item[];
  onFocusField: () => void;
};

/** One combobox field: text input, placeholders and the suggestion popup beside it. */
function SuggestField({
  className,
  icon,
  name,
  type,
  label,
  listLabel,
  placeholders,
  autoComplete,
  text,
  onText,
  items,
  onFocusField,
}: SuggestFieldProps) {
  const listboxId = useId();
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);

  const open = focused && !dismissed && text.trim() !== "" && items.length > 0;
  // A list that shrank under the highlight (a late lookup, a new query) drops it.
  const activeIndex = open && active < items.length ? active : -1;
  const count = open ? items.length : 0;

  const choose = (index: number) => {
    items[index]?.choose();
    setDismissed(true);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const n = items.length;
    switch (e.key) {
      case "ArrowDown":
        if (n === 0) return;
        e.preventDefault();
        setDismissed(false);
        setActive(
          !open || activeIndex < 0 || activeIndex >= n - 1
            ? 0
            : activeIndex + 1,
        );
        return;
      case "ArrowUp":
        if (n === 0) return;
        e.preventDefault();
        setDismissed(false);
        setActive(!open || activeIndex <= 0 ? n - 1 : activeIndex - 1);
        return;
      case "Enter":
        // Nothing highlighted: the form still submits, and the popup closes under it.
        if (activeIndex >= 0) {
          e.preventDefault();
          choose(activeIndex);
        } else {
          setDismissed(true);
        }
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          setDismissed(true);
          setActive(-1);
        }
        return;
      case "Tab":
        setDismissed(true);
        setActive(-1);
        return;
    }
  };

  const activeId =
    activeIndex >= 0 ? optionId(listboxId, activeIndex) : undefined;

  return (
    <div className={cn(field, "@xl:relative", className)}>
      {icon}
      <PlaceholdersAndVanishInput
        name={name}
        type={type}
        label={label}
        autoComplete={autoComplete}
        placeholders={placeholders}
        value={text}
        onValueChange={(next) => {
          setDismissed(false);
          setActive(-1);
          onText(next);
        }}
        inputProps={{
          role: "combobox",
          "aria-autocomplete": "list",
          "aria-expanded": open,
          // Only while the listbox exists: an IDREF to a missing element is invalid.
          "aria-controls": open ? listboxId : undefined,
          "aria-activedescendant": activeId,
          onFocus: () => {
            setFocused(true);
            setDismissed(false);
            onFocusField();
          },
          onBlur: () => {
            setFocused(false);
            setActive(-1);
          },
          onKeyDown,
        }}
      />
      <SuggestionPopup
        open={open}
        id={listboxId}
        label={listLabel}
        rows={items.map((item) => item.row)}
        active={activeIndex}
        onPick={choose}
        onHover={setActive}
      />
      {/* Announces the count when the popup opens or the count changes, not on every keystroke. */}
      <span aria-live="polite" className="sr-only">
        {count > 0
          ? `${count} ${count === 1 ? "suggestion" : "suggestions"}`
          : ""}
      </span>
    </div>
  );
}

export default function SearchBar({
  className = "",
  skillPlaceholders,
  placePlaceholders,
  searchLabel,
}: SearchBarProps) {
  const router = useRouter();
  const [subjectText, setSubjectText] = useState("");
  const [placeText, setPlaceText] = useState("");
  const [subjectPick, setSubjectPick] = useState<Option | null>(null);
  const [placePick, setPlacePick] = useState<PlacePick | null>(null);
  const [lookupsWanted, setLookupsWanted] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [lookups, setLookups] = useState<Lookups>(NO_LOOKUPS);

  const onFocusField = useCallback(() => {
    setLookupsWanted(true);
    setRetryTick((t) => t + 1);
  }, []);

  const subjectItems = useMemo<Item[]>(
    () =>
      suggestSubjects(subjectText, lookups.subjects, SUGGESTION_LIMIT).map(
        ({ entry, ranges }) => ({
          row: {
            key: `s-${entry.id}`,
            label: entry.name,
            ranges,
            icon: "subject",
          },
          choose: () => {
            setSubjectText(entry.name);
            setSubjectPick(entry);
          },
        }),
      ),
    [subjectText, lookups.subjects],
  );

  const placeItems = useMemo<Item[]>(
    () =>
      suggestPlaces(placeText, lookups.areas, SUGGESTION_LIMIT).map(
        ({ entry, ranges }) => ({
          row:
            entry.kind === "area"
              ? {
                  key: `a-${entry.id}`,
                  label: entry.name,
                  ranges,
                  secondary: entry.district,
                  icon: "place",
                }
              : {
                  key: `d-${entry.name}`,
                  label: entry.name,
                  ranges,
                  secondary: "Whole district",
                  icon: "place",
                },
          choose: () => {
            setPlaceText(placeLabel(entry));
            setPlacePick(entry);
          },
        }),
      ),
    [placeText, lookups.areas],
  );

  // Read synchronously from state: the vanish animation clears the inputs after submit.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (subjectPick) {
      params.set("subject", String(subjectPick.id));
    } else {
      const q = subjectText.slice(0, SEARCH_TEXT_MAX).trim();
      if (q) params.set("q", q);
    }
    if (placePick?.kind === "area") {
      params.set("area", String(placePick.id));
    } else if (placePick?.kind === "district") {
      params.set("district", placePick.name);
    } else {
      const location = placeText.slice(0, SEARCH_TEXT_MAX).trim();
      if (location) params.set("location", location);
    }
    const query = params.toString();
    router.push(query ? `/tutors?${query}` : "/tutors");
  };

  return (
    <div className={`@container w-full max-w-[640px] ${className}`}>
      {lookupsWanted && (
        <LookupLoader onLoaded={setLookups} retryTick={retryTick} />
      )}
      {/* action/method keep search working before hydration */}
      <form
        role="search"
        action="/tutors"
        method="get"
        onSubmit={onSubmit}
        className="border-chip-border @xl:rounded-chip relative flex flex-col gap-1 rounded-[var(--border-radius-24)] border bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] focus-within:ring-2 focus-within:ring-[var(--color-primary-core)]/30 @xl:flex-row @xl:items-center"
      >
        <SuggestField
          className=""
          icon={
            <Image
              src="/assets/ic/ic-search.png"
              alt=""
              width={20}
              height={20}
            />
          }
          name="q"
          type="search"
          label="Subject"
          listLabel="Subject suggestions"
          placeholders={skillPlaceholders}
          text={subjectText}
          onText={(next) => {
            setSubjectText(next);
            setSubjectPick(null);
          }}
          items={subjectItems}
          onFocusField={onFocusField}
        />

        <SuggestField
          className="border-chip-border border-t @xl:border-s @xl:border-t-0"
          icon={
            <Image
              src="/assets/ic/ic-pin-map.png"
              alt=""
              width={72}
              height={82}
              className="h-5 w-auto"
            />
          }
          name="location"
          label="Location"
          listLabel="Place suggestions"
          autoComplete="address-level2"
          placeholders={placePlaceholders}
          text={placeText}
          onText={(next) => {
            setPlaceText(next);
            setPlacePick(null);
          }}
          items={placeItems}
          onFocusField={onFocusField}
        />

        <button
          type="submit"
          className="rounded-chip min-h-12 shrink-0 bg-[var(--color-primary-core)] px-8 text-base font-semibold whitespace-nowrap text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)] active:scale-[0.97] active:bg-[var(--color-primary-pressed)] motion-reduce:active:scale-100"
        >
          {searchLabel}
        </button>
      </form>
    </div>
  );
}
