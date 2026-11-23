"use client";

import { useMemo, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  card,
  focusRing,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { ApplicationCard } from "@/components/applications/application-card";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { BackLink } from "@/components/ui/back-link";
import { HeaderLink, PageFrame } from "@/components/ui/page-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import {
  STATUS_META,
  useMyApplications,
  type ApplicationInitiator,
  type ApplicationStatus,
} from "@/lib/applications";

type StatusFilter = "ALL" | ApplicationStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: STATUS_META.REJECTED.label },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "CANCELLED", label: "Cancelled" },
];

const FILTER_VALUES = new Set<string>(FILTERS.map((f) => f.value));

const COPY = {
  TUTOR: {
    description:
      "Tuitions you applied to and students who requested your packages.",
    headerLink: { href: "/dashboard/find-tuitions", label: "Find tuitions" },
    emptyAll: "You haven't applied to any tuitions yet.",
    emptyNext: "Find a tuition to apply to.",
  },
  STUDENT: {
    description:
      "Tutors who applied to your requirements and packages you requested.",
    headerLink: { href: "/dashboard/find-tutors", label: "Find tutors" },
    emptyAll:
      "No tutors have applied to you yet, and you haven't requested any packages.",
    emptyNext: "Find a tutor to request.",
  },
} as const;

// Each stat tile lands here with one initiator; an empty list needs a next step, not "no match".
const EMPTY_BY_INITIATOR: Record<
  "TUTOR" | "STUDENT",
  Record<ApplicationInitiator, { text: string; href: string; cta: string }>
> = {
  TUTOR: {
    TUTOR: {
      text: "You haven't applied to any tuitions yet.",
      href: "/dashboard/find-tuitions",
      cta: "Find tuitions",
    },
    STUDENT: {
      text: "No students have requested your packages yet.",
      href: "/dashboard/tutor/packages",
      cta: "See your packages",
    },
  },
  STUDENT: {
    TUTOR: {
      text: "No tutors have applied to your requirements yet.",
      href: "/dashboard/find-tutors",
      cta: "Find tutors",
    },
    STUDENT: {
      text: "You haven't requested any packages yet.",
      href: "/dashboard/find-tutors?tab=packages",
      cta: "Browse packages",
    },
  },
};

// For a student, TUTOR means the applications tutors sent them, not ones the student sent.
const INITIATOR_LABEL: Record<
  "TUTOR" | "STUDENT",
  Record<ApplicationInitiator, string>
> = {
  TUTOR: {
    TUTOR: "Applications you sent",
    STUDENT: "Requests from students",
  },
  STUDENT: {
    TUTOR: "Applications from tutors",
    STUDENT: "Your requests",
  },
};

// Changing one filter must keep the other, so the URL is built from the current params.
function pageHref(
  pathname: string,
  current: URLSearchParams,
  changes: Record<string, string | null>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function ListSkeleton() {
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">Loading applications…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(card, "flex flex-col gap-4 p-5")}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="grid gap-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-20 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ApplicationsPage({ role }: { role: "TUTOR" | "STUDENT" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const copy = COPY[role];

  const raw = searchParams.get("status") ?? "ALL";
  const filter: StatusFilter = FILTER_VALUES.has(raw)
    ? (raw as StatusFilter)
    : "ALL";
  const statusParam = filter === "ALL" ? undefined : filter;

  const rawInitiator = searchParams.get("initiatedBy");
  const initiatedBy: ApplicationInitiator | undefined =
    rawInitiator === "TUTOR" || rawInitiator === "STUDENT"
      ? rawInitiator
      : undefined;

  const query = useMyApplications(statusParam, initiatedBy);
  const activeFilterRef = useRef<HTMLButtonElement>(null);

  const applications = useMemo(
    () => query.data?.pages.flatMap((page) => page.applications) ?? [],
    [query.data],
  );

  const onFilterChange = (value: StatusFilter) => {
    router.replace(
      pageHref(pathname, searchParams, {
        status: value === "ALL" ? null : value,
      }),
      { scroll: false },
    );
  };

  // The chip and empty-state buttons unmount with the click, so focus moves first to the
  // pressed status toggle, the one control that stays on screen.
  const clearFilters = (keys: ("status" | "initiatedBy")[]) => {
    activeFilterRef.current?.focus();
    const changes = Object.fromEntries(keys.map((key) => [key, null]));
    router.replace(pageHref(pathname, searchParams, changes), {
      scroll: false,
    });
  };

  const filterLabel = FILTERS.find((f) => f.value === filter)?.label ?? "All";
  const emptyInitiator = initiatedBy
    ? EMPTY_BY_INITIATOR[role][initiatedBy]
    : null;

  let body: ReactNode;
  if (query.isPending) {
    body = <ListSkeleton />;
  } else if (query.isError) {
    body = (
      <div
        role="alert"
        className={cn(card, "flex flex-col items-start gap-3 p-6")}
      >
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          Couldn&apos;t load your applications.
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          aria-busy={query.isFetching || undefined}
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          <PendingLabel pending={query.isFetching}>Try again</PendingLabel>
        </button>
      </div>
    );
  } else if (applications.length === 0) {
    body = (
      <div className={cn(card, "flex flex-col items-start gap-3 p-6")}>
        {initiatedBy && filter !== "ALL" ? (
          <>
            <p className="text-pretty text-[var(--color-text-secondary)]">
              {`No ${filterLabel.toLowerCase()} results in “${INITIATOR_LABEL[role][initiatedBy]}”.`}
            </p>
            <button
              type="button"
              onClick={() => clearFilters(["status", "initiatedBy"])}
              className={cn(secondaryButton, "min-h-10 px-4")}
            >
              Show all applications
            </button>
          </>
        ) : emptyInitiator ? (
          <>
            <p className="text-pretty text-[var(--color-text-secondary)]">
              {emptyInitiator.text}
            </p>
            <Link href={emptyInitiator.href} className={primaryButton}>
              <LinkPendingLabel>{emptyInitiator.cta}</LinkPendingLabel>
            </Link>
            <button
              type="button"
              onClick={() => clearFilters(["initiatedBy"])}
              className={cn(secondaryButton, "min-h-10 px-4")}
            >
              Show all applications
            </button>
          </>
        ) : filter === "ALL" ? (
          <>
            <p className="text-pretty text-[var(--color-text-secondary)]">
              {copy.emptyAll}
            </p>
            <Link href={copy.headerLink.href} className={primaryButton}>
              <LinkPendingLabel>{copy.emptyNext}</LinkPendingLabel>
            </Link>
          </>
        ) : (
          <>
            <p className="text-pretty text-[var(--color-text-secondary)]">
              {`No ${filterLabel.toLowerCase()} applications.`}
            </p>
            <button
              type="button"
              onClick={() => clearFilters(["status"])}
              className={cn(secondaryButton, "min-h-10 px-4")}
            >
              Show all applications
            </button>
          </>
        )}
      </div>
    );
  } else {
    body = (
      <ul className="grid gap-4">
        {applications.map((application, index) => (
          <li
            key={application.id}
            className={enterClass}
            style={enterStyle(index)}
          >
            <ApplicationCard application={application} role={role} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <PageFrame
      headerAction={
        <HeaderLink href={copy.headerLink.href}>
          <LinkPendingLabel>{copy.headerLink.label}</LinkPendingLabel>
        </HeaderLink>
      }
    >
      <BackLink href="/dashboard">Dashboard</BackLink>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
        Applications
      </h1>
      <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
        {copy.description}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <div className="grid gap-2">
          <div
            role="group"
            aria-label="Filter by status"
            className="flex flex-wrap gap-2"
          >
            {FILTERS.map((item) => {
              const pressed = item.value === filter;
              return (
                <button
                  key={item.value}
                  ref={pressed ? activeFilterRef : undefined}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onFilterChange(item.value)}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-[background-color,box-shadow,color] duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none",
                    pressed
                      ? "bg-[var(--color-primary-core)] text-[var(--color-neutral-white)]"
                      : "bg-[var(--color-neutral-white)] text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_1px_2px_rgb(0_0_0/0.06)] hover:bg-[var(--color-neutral-off-white)]",
                    focusRing,
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {initiatedBy && (
            <div>
              <span className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--color-secondary-sky)] ps-3 pe-1 text-sm font-medium text-[var(--color-primary-deep)]">
                {INITIATOR_LABEL[role][initiatedBy]}
                <button
                  type="button"
                  onClick={() => clearFilters(["initiatedBy"])}
                  aria-label={`Clear filter: ${INITIATOR_LABEL[role][initiatedBy]}`}
                  className={cn(
                    "relative flex size-6 items-center justify-center rounded-full transition-colors duration-150 after:absolute after:-inset-2.5 hover:bg-[color-mix(in_oklab,var(--color-primary-deep)_12%,transparent)]",
                    focusRing,
                  )}
                >
                  <X aria-hidden="true" className="size-3.5" strokeWidth={2} />
                </button>
              </span>
            </div>
          )}
        </div>
        <p
          aria-live="polite"
          className="text-sm text-[var(--color-text-secondary)] tabular-nums"
        >
          {query.data
            ? `${applications.length} ${applications.length === 1 ? "application" : "applications"} shown`
            : ""}
        </p>
      </div>

      <div className="mt-4">{body}</div>

      {query.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            aria-busy={query.isFetchingNextPage || undefined}
            className={cn(secondaryButton, "min-h-10 px-5")}
          >
            <PendingLabel pending={query.isFetchingNextPage}>
              Load more
            </PendingLabel>
          </button>
        </div>
      )}
    </PageFrame>
  );
}
