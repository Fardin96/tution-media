"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PUBLIC_TUTOR_PAGE,
  TUTOR_GENDERS,
  dedupeById,
  publicTutorFiltersFromSearchParams,
  publicTutorFiltersToSearchParams,
  usePublicTutors,
  type PublicTutorFilters,
  type TutorGender,
} from "@/lib/browse";
import { useAreas } from "@/lib/areas";
import { useSubjects } from "@/lib/subjects";
import {
  districtsOf,
  placeLabel,
  resolvePlace,
  resolveSubject,
  suggestPlaces,
  suggestSubjects,
} from "@/lib/tutor-search";
import { cn } from "@/lib/utils";
import { card, focusRing, secondaryButton } from "@/components/profile/styles";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { BackLink } from "@/components/ui/back-link";
import { PendingLabel } from "@/components/ui/pending-label";
import { EmptyCard, ErrorBlock, FilterSelect, Segmented } from "./browse-ui";
import { TutorCardsSkeleton } from "./find-tutors-page";
import { TutorResultCard } from "./tutor-result-card";

type ShowMode = "top" | "emerging";

const GENDER_LABEL: Record<TutorGender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

const SUGGESTIONS = 3;

function countLabel(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The URL for `params`, without a trailing "?" when there are none. */
function urlFor(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * The public tutors list. Every filter lives in the URL, so a reload or a shared link shows the same list.
 * Free text from the landing search (q, location) is swapped for ids once the subject or area list loads.
 */
export function PublicTutorsPage({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = useMemo(
    () => publicTutorFiltersFromSearchParams(searchParams),
    [searchParams],
  );

  const {
    subjects,
    isSuccess: subjectsLoaded,
    isError: subjectsErrored,
    refetch: refetchSubjects,
    isFetching: subjectsFetching,
  } = useSubjects();
  const {
    areas,
    isSuccess: areasLoaded,
    isError: areasErrored,
    refetch: refetchAreas,
    isFetching: areasFetching,
  } = useAreas();
  const subjectsSettled = subjectsLoaded || subjectsErrored;
  const areasSettled = areasLoaded || areasErrored;

  // Text is only resolved while no id covers the same filter, so a subject picked from the menu wins.
  const subjectText = url.subject === undefined ? url.q : undefined;
  const placeText =
    url.area === undefined && url.district === undefined
      ? url.location
      : undefined;

  const subjectMatch = useMemo(
    () =>
      subjectText !== undefined && subjectsLoaded
        ? resolveSubject(subjectText, subjects)
        : null,
    [subjectText, subjectsLoaded, subjects],
  );
  const placeMatch = useMemo(
    () =>
      placeText !== undefined && areasLoaded
        ? resolvePlace(placeText, areas)
        : null,
    [placeText, areasLoaded, areas],
  );

  // One replace swaps every matched text for its id and drops that text.
  useEffect(() => {
    if (!subjectMatch && !placeMatch) return;
    const next = new URLSearchParams(searchParams.toString());
    if (subjectMatch) {
      next.delete("q");
      next.set("subject", String(subjectMatch.id));
    }
    if (placeMatch) {
      next.delete("location");
      if (placeMatch.kind === "area") next.set("area", String(placeMatch.id));
      else next.set("district", placeMatch.name);
    }
    router.replace(urlFor(pathname, next), { scroll: false });
  }, [subjectMatch, placeMatch, searchParams, pathname, router]);

  const resolving =
    (subjectText !== undefined && !subjectsSettled) ||
    (placeText !== undefined && !areasSettled);
  // A failed list is not a miss: it gets its own notice and a retry.
  const subjectFailed = subjectText !== undefined && subjectsErrored;
  const subjectUnmatched =
    subjectText !== undefined && subjectsLoaded && !subjectMatch;
  const placeFailed = placeText !== undefined && areasErrored;
  const placeUnmatched = placeText !== undefined && areasLoaded && !placeMatch;
  const subjectSuggestions =
    subjectUnmatched && url.q
      ? suggestSubjects(url.q, subjects, SUGGESTIONS)
      : [];
  const placeSuggestions =
    placeUnmatched && url.location
      ? suggestPlaces(url.location, areas, SUGGESTIONS)
      : [];

  // Matched text already counts here, so the first query has the right filters and never flashes unfiltered rows.
  const placeIds: { area?: number; district?: string } =
    placeMatch === null
      ? {}
      : placeMatch.kind === "area"
        ? { area: placeMatch.id }
        : { district: placeMatch.name };
  const listFilters: PublicTutorFilters = {
    subject: url.subject ?? subjectMatch?.id,
    area: url.area ?? placeIds.area,
    district: url.district ?? placeIds.district,
    gender: url.gender,
    emerging: url.emerging,
  };
  const query = usePublicTutors(listFilters, !resolving);
  const tutors = dedupeById(
    query.data?.pages.flatMap((page) => page.tutors) ?? [],
  );

  const hasFilters = [
    url.subject,
    url.area,
    url.district,
    url.gender,
    url.q,
    url.location,
  ].some((value) => value !== undefined);
  const emerging = url.emerging === true;
  const here = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  // Each change writes the URL from the raw URL state, so unrelated filters and the sort survive.
  function replaceUrl(next: PublicTutorFilters) {
    router.replace(urlFor(pathname, publicTutorFiltersToSearchParams(next)), {
      scroll: false,
    });
  }

  function setSubject(value: string) {
    replaceUrl({
      ...url,
      subject: value === "" ? undefined : Number(value),
      q: undefined,
    });
  }

  // Area options are "a:<id>", a whole district is "d:<name>", and "" is anywhere.
  function setPlace(value: string) {
    if (value === "") {
      replaceUrl({
        ...url,
        area: undefined,
        district: undefined,
        location: undefined,
      });
    } else if (value.startsWith("a:")) {
      replaceUrl({
        ...url,
        area: Number(value.slice(2)),
        district: undefined,
        location: undefined,
      });
    } else {
      replaceUrl({
        ...url,
        area: undefined,
        district: value.slice(2),
        location: undefined,
      });
    }
  }

  const subjectValue =
    listFilters.subject === undefined ? "" : String(listFilters.subject);
  const areaValue =
    listFilters.area !== undefined
      ? `a:${listFilters.area}`
      : listFilters.district !== undefined
        ? `d:${listFilters.district}`
        : "";
  const districts = districtsOf(areas);
  const districtListed =
    listFilters.district !== undefined &&
    districts.includes(listFilters.district);
  const areaListed =
    listFilters.area !== undefined &&
    areas.some((a) => a.id === listFilters.area);
  const subjectListed =
    listFilters.subject !== undefined &&
    subjects.some((s) => s.id === listFilters.subject);

  const emptyShown = !resolving && query.isSuccess && tutors.length === 0;

  let body: ReactNode;
  if (resolving || query.isPending) {
    body = <TutorCardsSkeleton label="Loading tutors…" />;
  } else if (query.isError && !query.data) {
    body = (
      <ErrorBlock
        message="Couldn't load tutors."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  } else if (tutors.length === 0) {
    body =
      emerging && !hasFilters ? (
        <EmptyCard
          title="No new tutors yet."
          body="Tutors who joined in the last 90 days show up here."
        >
          <button
            type="button"
            onClick={() => replaceUrl({ ...url, emerging: false })}
            className={cn(secondaryButton, "min-h-10 px-4")}
          >
            See top-rated tutors
          </button>
        </EmptyCard>
      ) : (
        <EmptyCard
          title={
            hasFilters
              ? "No tutors match these filters."
              : "No tutors listed yet."
          }
        >
          {hasFilters && (
            <button
              type="button"
              onClick={() => replaceUrl({ emerging: url.emerging })}
              className={cn(secondaryButton, "min-h-10 px-4")}
            >
              Clear filters
            </button>
          )}
        </EmptyCard>
      );
  } else {
    body = (
      <>
        <ul
          aria-busy={query.isPlaceholderData || undefined}
          className={cn(
            "grid grid-cols-1 gap-4 transition-opacity duration-200 motion-reduce:transition-none sm:grid-cols-2 lg:grid-cols-3",
            query.isPlaceholderData && "opacity-60",
          )}
        >
          {tutors.map((tutor, index) => (
            <TutorResultCard
              key={tutor.id}
              tutor={tutor}
              locked={!signedIn}
              className={enterClass}
              style={enterStyle(index, PUBLIC_TUTOR_PAGE)}
            />
          ))}
        </ul>
        {query.hasNextPage && (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={query.isFetchingNextPage}
              aria-busy={query.isFetchingNextPage || undefined}
              onClick={() => void query.fetchNextPage()}
              className={cn(secondaryButton, "min-h-11 px-5")}
            >
              <PendingLabel pending={query.isFetchingNextPage}>
                Show more tutors
              </PendingLabel>
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <BackLink href={signedIn ? "/dashboard" : "/"}>
        {signedIn ? "Dashboard" : "Home"}
      </BackLink>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
        {emerging ? "Emerging masters" : "Find tutors"}
      </h1>
      <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
        {emerging
          ? "Top-rated tutors who joined in the last 90 days."
          : "Tutors by subject, area and gender, best rated first."}
      </p>

      <div className="mt-6 grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented<ShowMode>
            label="Show"
            value={emerging ? "emerging" : "top"}
            onChange={(next) =>
              replaceUrl({ ...url, emerging: next === "emerging" })
            }
            options={[
              { value: "top", label: "Top rated" },
              { value: "emerging", label: "Recently joined" },
            ]}
          />
          {/* The empty state has its own Clear filters, so it isn't shown twice. */}
          {hasFilters && !emptyShown && (
            <button
              type="button"
              onClick={() => replaceUrl({ emerging: url.emerging })}
              className={cn(secondaryButton, "min-h-10 px-4")}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect
            id="tutors-subject"
            label="Subject"
            value={subjectValue}
            onChange={setSubject}
          >
            <option value="">All subjects</option>
            {listFilters.subject !== undefined && !subjectListed && (
              <option value={subjectValue}>
                {subjectsLoaded ? "Selected subject" : "Loading…"}
              </option>
            )}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="tutors-area"
            label="Area"
            value={areaValue}
            onChange={setPlace}
          >
            <option value="">Anywhere</option>
            {listFilters.district !== undefined && !districtListed && (
              <option value={`d:${listFilters.district}`}>
                All of {listFilters.district}
              </option>
            )}
            {listFilters.area !== undefined && !areaListed && (
              <option value={`a:${listFilters.area}`}>
                {areasLoaded ? "Selected area" : "Loading…"}
              </option>
            )}
            {districts.map((district) => (
              <optgroup key={district} label={district}>
                <option value={`d:${district}`}>All of {district}</option>
                {areas
                  .filter((a) => a.district === district)
                  .map((a) => (
                    <option key={a.id} value={`a:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </FilterSelect>

          <FilterSelect
            id="tutors-gender"
            label="Gender"
            value={url.gender ?? ""}
            onChange={(next) =>
              replaceUrl({
                ...url,
                gender: next === "" ? undefined : (next as TutorGender),
              })
            }
          >
            <option value="">Any gender</option>
            {TUTOR_GENDERS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABEL[g]}
              </option>
            ))}
          </FilterSelect>
        </div>

        {(subjectFailed ||
          subjectUnmatched ||
          placeFailed ||
          placeUnmatched) && (
          <div
            role="status"
            className={cn(
              card,
              "grid gap-4 p-4 text-sm text-pretty text-[var(--color-text-secondary)]",
            )}
          >
            {subjectFailed && (
              <div className="flex flex-wrap items-center gap-2">
                <p>{"Couldn't load subjects, so all subjects are shown."}</p>
                <button
                  type="button"
                  disabled={subjectsFetching}
                  aria-busy={subjectsFetching || undefined}
                  onClick={() => void refetchSubjects()}
                  className={cn(secondaryButton, "min-h-10 px-4")}
                >
                  <PendingLabel pending={subjectsFetching}>
                    Try again
                  </PendingLabel>
                </button>
              </div>
            )}
            {placeFailed && (
              <div className="flex flex-wrap items-center gap-2">
                <p>{"Couldn't load areas, so all areas are shown."}</p>
                <button
                  type="button"
                  disabled={areasFetching}
                  aria-busy={areasFetching || undefined}
                  onClick={() => void refetchAreas()}
                  className={cn(secondaryButton, "min-h-10 px-4")}
                >
                  <PendingLabel pending={areasFetching}>Try again</PendingLabel>
                </button>
              </div>
            )}
            {subjectUnmatched && (
              <div className="grid gap-2">
                <p>No subject matches “{url.q}”, so all subjects are shown.</p>
                {subjectSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Did you mean</span>
                    {subjectSuggestions.map((s) => (
                      <button
                        key={s.entry.id}
                        type="button"
                        onClick={() =>
                          replaceUrl({
                            ...url,
                            subject: s.entry.id,
                            q: undefined,
                          })
                        }
                        className={cn(secondaryButton, "min-h-10 px-4")}
                      >
                        {s.entry.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {placeUnmatched && (
              <div className="grid gap-2">
                <p>No area matches “{url.location}”, so all areas are shown.</p>
                {placeSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Did you mean</span>
                    {placeSuggestions.map((s) => (
                      <button
                        key={`${s.entry.kind}-${placeLabel(s.entry)}`}
                        type="button"
                        onClick={() =>
                          replaceUrl(
                            s.entry.kind === "area"
                              ? {
                                  ...url,
                                  area: s.entry.id,
                                  district: undefined,
                                  location: undefined,
                                }
                              : {
                                  ...url,
                                  area: undefined,
                                  district: s.entry.name,
                                  location: undefined,
                                },
                          )
                        }
                        className={cn(secondaryButton, "min-h-10 px-4")}
                      >
                        {placeLabel(s.entry)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* {!signedIn && (
          <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
            Sign in to see full profiles and contact tutors.{" "}
            <Link
              href={`/sign-in?next=${encodeURIComponent(here)}`}
              className={cn(
                "rounded-sm font-semibold text-[var(--color-primary-core)] hover:underline",
                focusRing,
              )}
            >
              Sign in
            </Link>
          </p>
        )} */}

        <p aria-live="polite" className="sr-only">
          {query.isSuccess && !query.isPlaceholderData && !resolving
            ? `${countLabel(tutors.length, "tutor", "tutors")} shown`
            : ""}
        </p>
        {body}
      </div>
    </>
  );
}
