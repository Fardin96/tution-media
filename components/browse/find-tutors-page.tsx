"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BROWSE_CURRICULA,
  packageFiltersFromSearchParams,
  packageFiltersToSearchParams,
  useBrowsePackages,
  useNearbyTutors,
  useTutorSearch,
  type BrowseScope,
  type PackageBrowseFilters,
  type TutorGender,
  type TutorSearchFilters,
} from "@/lib/browse";
import {
  curriculumOf,
  levelOptionsFor,
  useEducationLookup,
} from "@/lib/education";
import { useAreas } from "@/lib/areas";
import { useSubjects } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import {
  card,
  focusRing,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { ActivePill } from "@/components/motion/active-pill";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { HeaderLink, PageFrame } from "@/components/ui/page-frame";
import { PackageCard } from "./package-card";
import { TutorResultCard } from "./tutor-result-card";
import { BackLink } from "@/components/ui/back-link";
import {
  EmptyCard,
  ErrorBlock,
  FilterSelect,
  SEGMENT_BUTTON,
  SEGMENT_IDLE,
  SEGMENT_PILL,
  SEGMENT_TEXT_SELECTED,
  SEGMENT_TRACK,
  Segmented,
  isClientError,
} from "./browse-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";

type Tab = "tutors" | "packages";
type TutorMode = "nearby" | "search";

const TABS: { id: Tab; label: string }[] = [
  { id: "tutors", label: "Tutors" },
  { id: "packages", label: "Packages" },
];

const RADIUS_KM = [2, 5, 10, 20] as const;
const DEFAULT_RADIUS_KM = 5;
const GENDER_LABEL: Record<TutorGender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function countLabel(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Placeholder rows shaped like a TutorResultCard. */
function TutorCardsSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(card, "flex flex-col gap-4 p-5")}
        >
          <div className="grid gap-2">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-20 shrink-0" />
              </div>
            </div>
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder rows shaped like a PackageCard. */
function PackageCardsSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(card, "flex flex-col gap-4 p-5")}
        >
          <div className="grid gap-1.5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-4 w-44 max-w-full" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="grid gap-1">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
            <div className="col-span-2 grid gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
          <Skeleton className="ms-auto mt-auto h-10 w-32 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function FindTutorsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: Tab =
    searchParams.get("tab") === "packages" ? "packages" : "tutors";
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    tutors: null,
    packages: null,
  });
  const pillId = useId();

  function selectTab(next: Tab) {
    if (next === tab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Arrow keys move between tabs and focus follows the selection, per the WAI-ARIA tabs pattern.
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const order = TABS.map((t) => t.id);
    const current = order.indexOf(tab);
    let next: number;
    if (e.key === "ArrowRight") next = (current + 1) % order.length;
    else if (e.key === "ArrowLeft")
      next = (current - 1 + order.length) % order.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = order.length - 1;
    else return;
    e.preventDefault();
    selectTab(order[next]);
    tabRefs.current[order[next]]?.focus();
  }

  return (
    <PageFrame
      headerAction={
        <HeaderLink href="/dashboard/applications">
          <LinkPendingLabel>My applications</LinkPendingLabel>
        </HeaderLink>
      }
    >
      <BackLink href="/dashboard">Dashboard</BackLink>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
        Find tutors
      </h1>
      <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
        Tutors and packages near you.
      </p>

      <div className="mt-6 grid gap-6">
        <div role="tablist" aria-label="Browse" className={SEGMENT_TRACK}>
          {TABS.map((t) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(t.id)}
                onKeyDown={onTabKeyDown}
                className={cn(
                  SEGMENT_BUTTON,
                  "relative isolate",
                  selected ? SEGMENT_TEXT_SELECTED : SEGMENT_IDLE,
                )}
              >
                {selected && (
                  <ActivePill layoutId={pillId} className={SEGMENT_PILL} />
                )}
                {t.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
          className={cn("rounded-[24px]", focusRing)}
        >
          {tab === "tutors" ? <TutorsPanel /> : <PackagesPanel />}
        </div>
      </div>
    </PageFrame>
  );
}

/* ───────── Tutors ───────── */

function TutorsPanel() {
  const [mode, setMode] = useState<TutorMode>("nearby");

  return (
    <div className="grid gap-6">
      <Segmented<TutorMode>
        label="Find tutors by"
        value={mode}
        onChange={setMode}
        options={[
          { value: "nearby", label: "Near me" },
          { value: "search", label: "Search" },
        ]}
      />
      {mode === "nearby" ? <NearbyTutors /> : <SearchTutors />}
    </div>
  );
}

function NearbyTutors() {
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const query = useNearbyTutors(radiusKm * 1000, true);
  const tutors = query.data?.tutors ?? [];
  const noLocation = query.isError && isClientError(query.error);

  let body: React.ReactNode;
  if (query.isPending) {
    body = <TutorCardsSkeleton label="Loading tutors near you…" />;
  } else if (noLocation || (query.isSuccess && tutors.length === 0)) {
    body = (
      <EmptyCard
        title="No tutors near you yet."
        body="Add your address on your profile to see tutors near you."
      >
        <Link href="/dashboard" className={cn(primaryButton, "min-h-10 px-4")}>
          <LinkPendingLabel>Go to your profile</LinkPendingLabel>
        </Link>
      </EmptyCard>
    );
  } else if (query.isError) {
    body = (
      <ErrorBlock
        message="Couldn't load tutors near you."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  } else {
    body = (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tutors.map((tutor, index) => (
          <TutorResultCard
            key={tutor.id}
            tutor={tutor}
            className={enterClass}
            style={enterStyle(index)}
          />
        ))}
      </ul>
    );
  }

  return (
    <section aria-label="Tutors near me" className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <FilterSelect
          id="tutor-radius"
          label="Radius"
          value={String(radiusKm)}
          onChange={(v) => setRadiusKm(Number(v))}
        >
          {RADIUS_KM.map((km) => (
            <option key={km} value={km}>
              Within {km} km
            </option>
          ))}
        </FilterSelect>
        {query.isSuccess && !noLocation && (
          <p
            aria-live="polite"
            className="text-sm text-[var(--color-text-secondary)] tabular-nums"
          >
            {countLabel(tutors.length, "tutor", "tutors")}
          </p>
        )}
      </div>
      {body}
    </section>
  );
}

function SearchTutors() {
  const { subjects } = useSubjects();
  const { areas } = useAreas();
  const [nameInput, setNameInput] = useState("");
  const [area, setArea] = useState("");
  const [subject, setSubject] = useState("");
  const [gender, setGender] = useState<TutorGender | "">("");

  const name = useDebouncedValue(nameInput.trim(), 300);
  const filters: TutorSearchFilters = useMemo(
    () => ({
      name: name || undefined,
      area: area ? Number(area) : undefined,
      subject: subject ? Number(subject) : undefined,
      gender: gender || undefined,
    }),
    [name, area, subject, gender],
  );
  const query = useTutorSearch(filters);
  const tutors = query.data?.tutors ?? [];
  const hasFilters = !!(name || area || subject || gender);

  function clearFilters() {
    setNameInput("");
    setArea("");
    setSubject("");
    setGender("");
  }

  let body: React.ReactNode;
  if (query.isPending) {
    body = <TutorCardsSkeleton label="Searching tutors…" />;
  } else if (query.isError) {
    body = (
      <ErrorBlock
        message="Couldn't search tutors."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  } else if (tutors.length === 0) {
    body = (
      <EmptyCard title="No tutors match these filters.">
        <button
          type="button"
          onClick={clearFilters}
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          Clear filters
        </button>
      </EmptyCard>
    );
  } else {
    body = (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tutors.map((tutor, index) => (
          <TutorResultCard
            key={tutor.id}
            tutor={tutor}
            className={enterClass}
            style={enterStyle(index)}
          />
        ))}
      </ul>
    );
  }

  return (
    <section aria-label="Search tutors" className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid min-w-0 gap-1.5">
          <label
            htmlFor="tutor-name"
            className="text-sm font-medium text-[var(--color-neutral-charcoal)]"
          >
            Tutor name
          </label>
          <input
            id="tutor-name"
            type="search"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Search by name"
            autoComplete="off"
            maxLength={100}
            className={cn(
              "min-h-11 min-w-0 rounded-xl bg-[var(--color-neutral-white)] px-3 text-sm text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_1px_2px_rgb(0_0_0/0.06)] placeholder:text-[var(--color-text-secondary)]",
              focusRing,
            )}
          />
        </div>
        <FilterSelect
          id="tutor-area"
          label="Area"
          value={area}
          onChange={setArea}
        >
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          id="tutor-subject"
          label="Subject"
          value={subject}
          onChange={setSubject}
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          id="tutor-gender"
          label="Gender"
          value={gender}
          onChange={(v) => setGender(v as TutorGender | "")}
        >
          <option value="">Any gender</option>
          {(Object.keys(GENDER_LABEL) as TutorGender[]).map((g) => (
            <option key={g} value={g}>
              {GENDER_LABEL[g]}
            </option>
          ))}
        </FilterSelect>
      </div>

      {query.isSuccess && (
        <p
          aria-live="polite"
          className="text-sm text-[var(--color-text-secondary)] tabular-nums"
        >
          {countLabel(tutors.length, "tutor", "tutors")}
          {hasFilters ? " found" : ""}
        </p>
      )}
      {body}
    </section>
  );
}

/* ───────── Packages ───────── */

function PackagesPanel() {
  const { subjects } = useSubjects();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => packageFiltersFromSearchParams(searchParams),
    [searchParams],
  );
  const query = useBrowsePackages(filters);
  const { data: lookup } = useEducationLookup();

  const packages = query.data?.pages.flatMap((page) => page.packages) ?? [];
  const locationMissing = query.data?.pages[0]?.locationMissing ?? false;
  const levels = levelOptionsFor(
    lookup,
    filters.curriculum ? [filters.curriculum] : [...BROWSE_CURRICULA],
  );

  // Every filter lives in the URL, so a reload or a shared link shows the same list.
  function update(patch: Partial<PackageBrowseFilters>) {
    const params = packageFiltersToSearchParams({ ...filters, ...patch });
    params.set("tab", "packages");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  let body: React.ReactNode;
  if (query.isPending) {
    body = <PackageCardsSkeleton label="Loading packages…" />;
  } else if (query.isError) {
    body = (
      <ErrorBlock
        message="Couldn't load packages."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  } else if (packages.length === 0) {
    // Empty result for the current filters. Packages are live, so the copy points at the filters, not at a future feature.
    body = (
      <div className={cn(card, "grid gap-3 p-6")}>
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          No packages found
        </p>
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          No packages match these filters yet. Browse tutors or post a
          requirement instead.
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Link
            href="/dashboard/find-tutors?tab=tutors"
            className={cn(secondaryButton, "min-h-10 px-4")}
          >
            <LinkPendingLabel>Browse tutors</LinkPendingLabel>
          </Link>
          <Link
            href="/dashboard/requirements/new"
            className={cn(primaryButton, "min-h-10 px-4")}
          >
            <LinkPendingLabel>Post a requirement</LinkPendingLabel>
          </Link>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg, index) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              className={enterClass}
              style={enterStyle(index)}
            />
          ))}
        </ul>
        {query.hasNextPage && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              disabled={query.isFetchingNextPage}
              aria-busy={query.isFetchingNextPage || undefined}
              onClick={() => void query.fetchNextPage()}
              className={cn(secondaryButton, "min-h-11 px-5")}
            >
              <PendingLabel pending={query.isFetchingNextPage}>
                Load more
              </PendingLabel>
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <section aria-label="Packages" className="grid gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented<BrowseScope>
          label="Location"
          value={filters.scope}
          onChange={(scope) => update({ scope })}
          options={[
            { value: "nearby", label: "Near me" },
            { value: "all", label: "All" },
          ]}
        />
        <FilterSelect
          id="package-curriculum"
          label="Curriculum"
          value={filters.curriculum ?? ""}
          onChange={(v) =>
            update({
              curriculum: (v ||
                undefined) as PackageBrowseFilters["curriculum"],
              levelCode: undefined,
            })
          }
        >
          <option value="">All curricula</option>
          {BROWSE_CURRICULA.map((c) => (
            <option key={c} value={c}>
              {curriculumOf(lookup, c)?.label ?? c}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          id="package-level"
          label="Level"
          value={
            filters.levelCode === undefined ? "" : String(filters.levelCode)
          }
          onChange={(v) =>
            update({ levelCode: v === "" ? undefined : Number(v) })
          }
        >
          <option value="">All levels</option>
          {levels.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          id="package-subject"
          label="Subject"
          value={
            filters.subjectId === undefined ? "" : String(filters.subjectId)
          }
          onChange={(v) =>
            update({ subjectId: v === "" ? undefined : Number(v) })
          }
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
      </div>

      {locationMissing && (
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          Showing online packages and packages in your area. Add your address
          for better results.
        </p>
      )}

      {query.isSuccess && packages.length > 0 && (
        <p
          aria-live="polite"
          className="text-sm text-[var(--color-text-secondary)] tabular-nums"
        >
          {countLabel(packages.length, "package", "packages")}
        </p>
      )}
      {body}
    </section>
  );
}
