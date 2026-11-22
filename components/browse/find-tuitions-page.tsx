"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  card,
  ghostButton,
  secondaryButton,
} from "@/components/profile/styles";
import { HeaderLink, PageFrame } from "@/components/ui/page-frame";
import {
  EmptyCard,
  ErrorBlock,
  FilterSelect,
  Segmented,
} from "@/components/browse/browse-ui";
import { BackLink } from "@/components/ui/back-link";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import {
  TuitionCard,
  type TuitionApplyState,
} from "@/components/browse/tuition-card";
import { ReadinessChecklist } from "@/components/profile/readiness-checklist";
import { useApplyToRequirement } from "@/lib/applications";
import {
  dedupeById,
  requirementFiltersFromSearchParams,
  requirementFiltersToSearchParams,
  useBrowseRequirements,
  type RequirementBrowseFilters,
  type RequirementBrowseScope,
  type RequirementSort,
  type TutorGap,
} from "@/lib/browse";
import {
  curriculumOf,
  educationSummary,
  levelOptionsFor,
  useEducationLookup,
} from "@/lib/education";
import { queryKeys } from "@/lib/query-keys";
import { optionName, profileApi } from "@/lib/profile";
import { useAreas } from "@/lib/areas";
import { useSubjects } from "@/lib/subjects";
import { toastError, toastSuccess } from "@/lib/toast";
import { useTutorRequirements } from "@/lib/tutor-requirements";

const SCOPES: { value: RequirementBrowseScope; label: string }[] = [
  { value: "nearby", label: "Near me" },
  { value: "all", label: "All open" },
  { value: "set", label: "My sets" },
  { value: "invited", label: "Invited" },
];

const SORTS: { value: RequirementSort; label: string }[] = [
  { value: "match", label: "Best match" },
  { value: "newest", label: "Newest" },
];

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

/** Placeholder rows shaped like a TuitionCard, so the list does not jump when it loads. */
function TuitionCardsSkeleton({ label }: { label: string }) {
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
          className={cn(card, "flex flex-col gap-5 p-5 sm:p-6")}
        >
          <div className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-7 w-3/4" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="grid gap-1">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-4 w-44 max-w-full" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Copy for a suggestion that would fill an empty set page. */
function gapText(gap: TutorGap): string {
  const n = gap.requirements;
  switch (gap.code) {
    case "WIDER_LEVEL":
      return `Widen your class range: ${n} more open ${plural(n, "tuition", "tuitions")}`;
    case "OTHER_SUBJECTS":
      return `Add subjects: ${n} open ${plural(n, "tuition", "tuitions")} at your classes ${plural(n, "needs", "need")} other subjects`;
    case "TEACH_ONLINE":
      return `Teach online: ${n} more online ${plural(n, "tuition", "tuitions")}`;
  }
}

/** Reads /me for the tutor's apply readiness. Shares the `me` key with the rest of the app. */
function useMeAccount() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => profileApi.me(),
  });
}

export function FindTuitionsPage() {
  const router = useRouter();
  const { subjects } = useSubjects();
  const { areas } = useAreas();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => requirementFiltersFromSearchParams(searchParams),
    [searchParams],
  );
  const hasFilters =
    filters.curriculum !== undefined ||
    filters.levelCode !== undefined ||
    filters.subjectId !== undefined ||
    filters.areaId !== undefined;

  const education = useEducationLookup();
  const lookup = education.data;
  const me = useMeAccount();
  const readiness = me.data?.applyReadiness;
  const blockedReason =
    readiness && !readiness.ready ? "Finish your profile to apply." : null;

  const isSetMode = filters.scope === "set";
  const missing = readiness && !readiness.ready ? readiness.missing : [];
  const needsDefaultSet = missing.includes("default_requirement");
  const sets = useTutorRequirements("active", isSetMode || needsDefaultSet);
  const activeSets = sets.data ?? [];
  // A set id from the URL that is not an active set falls back to the default.
  const selectedSetId = isSetMode
    ? (activeSets.find((s) => s.id === filters.setId)?.id ??
      activeSets.find((s) => s.isDefault)?.id)
    : undefined;

  const browseFilters = useMemo<RequirementBrowseFilters>(
    () =>
      isSetMode
        ? { scope: "set", setId: selectedSetId, sort: filters.sort }
        : filters,
    [isSetMode, selectedSetId, filters],
  );
  const browse = useBrowseRequirements(browseFilters);
  const apply = useApplyToRequirement();

  // A match cursor can restart after a config change, so appended pages may repeat rows.
  const rows = dedupeById(
    browse.data?.pages.flatMap((page) => page.requirements) ?? [],
  );
  const noServiceArea = browse.data?.pages[0]?.noServiceArea ?? false;
  // Gaps only come back with the first page of an empty set.
  const gaps = browse.data?.pages[0]?.gaps ?? [];
  // Undefined until the sets load, null when there is no default set.
  const defaultSet = sets.isSuccess
    ? (activeSets.find((s) => s.isDefault) ?? null)
    : undefined;

  // Puts the resolved set in the URL so the page can be shared as shown.
  useEffect(() => {
    if (!isSetMode || !sets.isSuccess || filters.setId === selectedSetId) {
      return;
    }
    const query = requirementFiltersToSearchParams({
      scope: "set",
      setId: selectedSetId,
    }).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [
    isSetMode,
    sets.isSuccess,
    filters.setId,
    selectedSetId,
    pathname,
    router,
  ]);

  function setFilters(next: RequirementBrowseFilters) {
    const query = requirementFiltersToSearchParams(next).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function patch(change: Partial<RequirementBrowseFilters>) {
    setFilters({ ...filters, ...change });
  }

  function onCurriculumChange(value: string) {
    const curriculum =
      value === ""
        ? undefined
        : (value as RequirementBrowseFilters["curriculum"]);
    // A class only stays selected if the new curriculum offers it.
    const levelStillValid =
      filters.levelCode === undefined ||
      curriculum === undefined ||
      (curriculumOf(lookup, curriculum)?.levels.some(
        (l) => l.code === filters.levelCode,
      ) ??
        false);
    setFilters({
      ...filters,
      curriculum,
      levelCode: levelStillValid ? filters.levelCode : undefined,
    });
  }

  const levelOptions = !lookup
    ? []
    : filters.curriculum
      ? (curriculumOf(lookup, filters.curriculum)?.levels ?? [])
      : levelOptionsFor(
          lookup,
          lookup.curricula.map((c) => c.code),
        );

  function onApply(requirementId: string) {
    apply.mutate(requirementId, {
      onSuccess: (result) =>
        toastSuccess(result ? "Application sent." : "You've already applied."),
      onError: (err) => toastError("Couldn't send your application.", err),
    });
  }

  function applyStateFor(row: (typeof rows)[number]): TuitionApplyState {
    if (row.closed) return { kind: "closed" };
    if (row.myApplication) {
      return {
        kind: "applied",
        applicationId: row.myApplication.id,
        status: row.myApplication.status,
      };
    }
    return {
      kind: "open",
      applying: apply.isPending && apply.variables === row.id,
      // The apply mutation is shared by every row, so the other rows wait while one runs.
      busy: apply.isPending,
      blockedReason,
      onApply: () => onApply(row.id),
    };
  }

  const count = rows.length;
  const more = browse.hasNextPage;

  return (
    <PageFrame
      headerAction={
        <HeaderLink href="/dashboard/applications">
          <LinkPendingLabel>My applications</LinkPendingLabel>
        </HeaderLink>
      }
    >
      <BackLink href="/dashboard">Dashboard</BackLink>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
        Find tuitions
      </h1>
      <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
        {isSetMode
          ? "Open requirements that match one of your sets."
          : filters.scope === "invited"
            ? "Open requirements that students invited you to apply to."
            : "Open requirements from students near your teaching zones and areas."}
      </p>

      {readiness && !readiness.ready && (
        <ReadinessChecklist
          className="mt-6"
          missing={missing}
          defaultSet={defaultSet}
          title="Finish your profile to apply"
          description="Applications stay off until these are done."
        />
      )}

      <section
        aria-label="Filters"
        className={cn(card, "mt-6 grid gap-5 p-5 sm:p-6")}
      >
        <Segmented<RequirementBrowseScope>
          label="Scope"
          options={SCOPES}
          value={filters.scope}
          onChange={(scope) => patch({ scope })}
        />

        {filters.scope === "invited" ? null : isSetMode ? (
          sets.isSuccess &&
          activeSets.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FilterSelect
                  id="filter-set"
                  label="Requirement set"
                  value={selectedSetId ?? ""}
                  onChange={(value) =>
                    setFilters({
                      scope: "set",
                      setId: value || undefined,
                      sort: filters.sort,
                    })
                  }
                >
                  {selectedSetId === undefined && (
                    <option value="">Choose a set</option>
                  )}
                  {activeSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.isDefault ? `${s.name} (default)` : s.name}
                    </option>
                  ))}
                </FilterSelect>
              </div>
              <Segmented<RequirementSort>
                label="Sort"
                options={SORTS}
                value={filters.sort ?? "match"}
                onChange={(sort) =>
                  patch({ sort: sort === "newest" ? "newest" : undefined })
                }
              />
            </>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              id="filter-curriculum"
              label="Curriculum"
              value={filters.curriculum ?? ""}
              onChange={onCurriculumChange}
            >
              <option value="">All curricula</option>
              {lookup?.curricula.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              id="filter-level"
              label="Class"
              value={
                filters.levelCode === undefined ? "" : String(filters.levelCode)
              }
              onChange={(value) =>
                patch({ levelCode: value === "" ? undefined : Number(value) })
              }
            >
              <option value="">All classes</option>
              {levelOptions.map((l) => (
                <option key={l.code} value={String(l.code)}>
                  {l.label}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              id="filter-subject"
              label="Subject"
              value={
                filters.subjectId === undefined ? "" : String(filters.subjectId)
              }
              onChange={(value) =>
                patch({ subjectId: value === "" ? undefined : Number(value) })
              }
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              id="filter-area"
              label="Area"
              value={filters.areaId === undefined ? "" : String(filters.areaId)}
              onChange={(value) =>
                patch({ areaId: value === "" ? undefined : Number(value) })
              }
            >
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </FilterSelect>
          </div>
        )}

        {!isSetMode && hasFilters && (
          <div>
            <button
              type="button"
              onClick={() => setFilters({ scope: filters.scope })}
              className={ghostButton}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p
          aria-live="polite"
          className="text-sm font-medium text-[var(--color-neutral-charcoal)] tabular-nums"
        >
          {browse.isPending || browse.isError
            ? ""
            : `${count}${more ? "+" : ""} ${plural(count, "tuition", "tuitions")}`}
        </p>
      </div>

      <div className="mt-3">
        {browse.isError && (
          <div className="mb-4">
            <ErrorBlock
              message="Couldn't load tuitions."
              onRetry={() => void browse.refetch()}
              retrying={browse.isFetching}
            />
          </div>
        )}

        {isSetMode && sets.isPending ? (
          <TuitionCardsSkeleton label="Loading your sets…" />
        ) : isSetMode && sets.isError ? (
          <ErrorBlock
            message="Couldn't load your sets."
            onRetry={() => void sets.refetch()}
            retrying={sets.isFetching}
          />
        ) : isSetMode && activeSets.length === 0 ? (
          <EmptyCard title="You have no requirement sets yet.">
            <Link
              href="/dashboard/tutor/requirements/new"
              className={secondaryButton}
            >
              <LinkPendingLabel>Create a set</LinkPendingLabel>
            </Link>
          </EmptyCard>
        ) : isSetMode && selectedSetId === undefined ? (
          <EmptyCard title="Choose a set to see matching tuitions." />
        ) : browse.isPending ? (
          <TuitionCardsSkeleton label="Loading tuitions…" />
        ) : rows.length > 0 ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <li key={row.id}>
                  <TuitionCard
                    tuition={row}
                    subjectNames={row.subjectIds.map((id) =>
                      optionName(subjects, id),
                    )}
                    curriculumLabel={
                      curriculumOf(lookup, row.curriculum)?.label ?? null
                    }
                    levelLabel={educationSummary(lookup, row) || "Any class"}
                    areaName={
                      row.areaId === null ? null : optionName(areas, row.areaId)
                    }
                    apply={applyStateFor(row)}
                  />
                </li>
              ))}
            </ul>
            {more && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => void browse.fetchNextPage()}
                  disabled={browse.isFetchingNextPage}
                  aria-busy={browse.isFetchingNextPage || undefined}
                  className={secondaryButton}
                >
                  <PendingLabel pending={browse.isFetchingNextPage}>
                    Load more
                  </PendingLabel>
                </button>
              </div>
            )}
          </>
        ) : browse.isError ? null : filters.scope === "nearby" &&
          noServiceArea ? (
          <EmptyCard title="Add a teaching zone or area so we can show tuitions near you.">
            <Link href="/dashboard/tutor/zones" className={secondaryButton}>
              <LinkPendingLabel>Add a teaching zone</LinkPendingLabel>
            </Link>
          </EmptyCard>
        ) : hasFilters ? (
          <EmptyCard title="No open tuitions match these filters.">
            <button
              type="button"
              onClick={() => setFilters({ scope: filters.scope })}
              className={secondaryButton}
            >
              Clear filters
            </button>
          </EmptyCard>
        ) : isSetMode ? (
          gaps.length > 0 && selectedSetId ? (
            <EmptyCard title="No open tuitions match this set.">
              <div className="grid w-full gap-3">
                <ul className="grid gap-2 text-sm text-[var(--color-neutral-charcoal)]">
                  {gaps.map((gap) => (
                    <li key={gap.code}>{gapText(gap)}</li>
                  ))}
                </ul>
                <div>
                  <Link
                    href={`/dashboard/tutor/requirements/${selectedSetId}/edit`}
                    className={secondaryButton}
                  >
                    <LinkPendingLabel>Edit this set</LinkPendingLabel>
                  </Link>
                </div>
              </div>
            </EmptyCard>
          ) : (
            <EmptyCard title="No open tuitions match this set." />
          )
        ) : filters.scope === "invited" ? (
          <EmptyCard title="No invitations right now." />
        ) : (
          <EmptyCard title="No open tuitions right now." />
        )}
      </div>
    </PageFrame>
  );
}
