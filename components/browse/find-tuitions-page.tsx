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
  SkeletonCards,
} from "@/components/browse/browse-ui";
import { BackLink } from "@/components/ui/back-link";
import {
  TuitionCard,
  type TuitionApplyState,
} from "@/components/browse/tuition-card";
import { missingRequirementLabel } from "@/lib/api-errors";
import { useApplyToRequirement } from "@/lib/applications";
import {
  requirementFiltersFromSearchParams,
  requirementFiltersToSearchParams,
  useBrowseRequirements,
  type RequirementBrowseFilters,
  type RequirementBrowseScope,
} from "@/lib/browse";
import {
  curriculumOf,
  educationSummary,
  levelOptionsFor,
  useEducationLookup,
} from "@/lib/education";
import { queryKeys } from "@/lib/query-keys";
import { AREAS, SUBJECTS, optionName, profileApi } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";
import { useTutorRequirements } from "@/lib/tutor-requirements";

const SCOPES: { value: RequirementBrowseScope; label: string }[] = [
  { value: "nearby", label: "Near me" },
  { value: "all", label: "All open" },
  { value: "set", label: "My sets" },
];

/** Readiness fixes, each on the page that owns it. */
const FIX_LINKS = [
  { href: "/dashboard", label: "Update profile" },
  { href: "/dashboard/tutor/zones", label: "Teaching zones" },
  { href: "/dashboard/tutor/requirements", label: "Default requirement set" },
];

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
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
  const sets = useTutorRequirements("active", isSetMode);
  const activeSets = sets.data ?? [];
  // A set id from the URL that is not an active set falls back to the default.
  const selectedSetId = isSetMode
    ? (activeSets.find((s) => s.id === filters.setId)?.id ??
      activeSets.find((s) => s.isDefault)?.id)
    : undefined;

  const browseFilters = useMemo<RequirementBrowseFilters>(
    () => (isSetMode ? { scope: "set", setId: selectedSetId } : filters),
    [isSetMode, selectedSetId, filters],
  );
  const browse = useBrowseRequirements(browseFilters);
  const apply = useApplyToRequirement();

  const rows = browse.data?.pages.flatMap((page) => page.requirements) ?? [];
  const noServiceArea = browse.data?.pages[0]?.noServiceArea ?? false;
  const missing = readiness && !readiness.ready ? readiness.missing : [];

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
      blockedReason,
      onApply: () => onApply(row.id),
    };
  }

  const count = rows.length;
  const more = browse.hasNextPage;

  return (
    <PageFrame
      headerAction={
        <HeaderLink href="/dashboard/applications">My applications</HeaderLink>
      }
    >
      <BackLink href="/dashboard">Dashboard</BackLink>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
        Find tuitions
      </h1>
      <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
        {isSetMode
          ? "Open requirements that match one of your sets."
          : "Open requirements from students near your teaching zones and areas."}
      </p>

      {readiness && !readiness.ready && (
        <section
          aria-labelledby="apply-readiness-title"
          className={cn(card, "mt-6 grid gap-4 p-5 sm:p-6")}
        >
          <div className="grid gap-1">
            <h2
              id="apply-readiness-title"
              className="text-base font-semibold text-[var(--color-neutral-charcoal)]"
            >
              Finish your profile to apply
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Applications stay off until these are done.
            </p>
          </div>
          {missing.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {missing.map((code) => (
                <li
                  key={code}
                  className="rounded-full bg-[var(--color-semantic-warning-surface)] px-3 py-1 text-sm font-medium text-[var(--color-semantic-warning-text)]"
                >
                  {missingRequirementLabel(code)}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {FIX_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(secondaryButton, "min-h-10 px-4")}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
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

        {isSetMode ? (
          sets.isSuccess &&
          activeSets.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect
                id="filter-set"
                label="Requirement set"
                value={selectedSetId ?? ""}
                onChange={(value) =>
                  setFilters({ scope: "set", setId: value || undefined })
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
              {SUBJECTS.map((s) => (
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
              {AREAS.map((a) => (
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
            />
          </div>
        )}

        {isSetMode && sets.isPending ? (
          <SkeletonCards label="Loading your sets" />
        ) : isSetMode && sets.isError ? (
          <ErrorBlock
            message="Couldn't load your sets."
            onRetry={() => void sets.refetch()}
          />
        ) : isSetMode && activeSets.length === 0 ? (
          <EmptyCard title="You have no requirement sets yet.">
            <Link
              href="/dashboard/tutor/requirements/new"
              className={secondaryButton}
            >
              Create a set
            </Link>
          </EmptyCard>
        ) : isSetMode && selectedSetId === undefined ? (
          <EmptyCard title="Choose a set to see matching tuitions." />
        ) : browse.isPending ? (
          <SkeletonCards label="Loading tuitions" />
        ) : rows.length > 0 ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <li key={row.id}>
                  <TuitionCard
                    tuition={row}
                    subjectNames={row.subjectIds.map((id) =>
                      optionName(SUBJECTS, id),
                    )}
                    curriculumLabel={
                      curriculumOf(lookup, row.curriculum)?.label ?? null
                    }
                    levelLabel={educationSummary(lookup, row) || "Any class"}
                    areaName={
                      row.areaId === null ? null : optionName(AREAS, row.areaId)
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
                  className={secondaryButton}
                >
                  {browse.isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        ) : browse.isError ? null : filters.scope === "nearby" &&
          noServiceArea ? (
          <EmptyCard title="Add a teaching zone or area so we can show tuitions near you.">
            <Link href="/dashboard/tutor/zones" className={secondaryButton}>
              Add a teaching zone
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
          <EmptyCard title="No open tuitions match this set." />
        ) : (
          <EmptyCard title="No open tuitions right now." />
        )}
      </div>
    </PageFrame>
  );
}
