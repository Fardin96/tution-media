"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  card,
  focusRing,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { ApplicationCard } from "@/components/applications/application-card";
import { BackLink } from "@/components/ui/back-link";
import { HeaderLink, PageFrame } from "@/components/ui/page-frame";
import {
  STATUS_META,
  useMyApplications,
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

function ListSkeleton() {
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">Loading applications</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(
            card,
            "h-56 animate-pulse p-5 motion-reduce:animate-none",
          )}
        />
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

  const query = useMyApplications(statusParam);

  const applications = useMemo(
    () => query.data?.pages.flatMap((page) => page.applications) ?? [],
    [query.data],
  );

  const onFilterChange = (value: StatusFilter) => {
    router.replace(value === "ALL" ? pathname : `${pathname}?status=${value}`, {
      scroll: false,
    });
  };

  const filterLabel = FILTERS.find((f) => f.value === filter)?.label ?? "All";

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
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          Try again
        </button>
      </div>
    );
  } else if (applications.length === 0) {
    body = (
      <div className={cn(card, "flex flex-col items-start gap-3 p-6")}>
        {filter === "ALL" ? (
          <>
            <p className="text-pretty text-[var(--color-text-secondary)]">
              {copy.emptyAll}
            </p>
            <Link href={copy.headerLink.href} className={primaryButton}>
              {copy.emptyNext}
            </Link>
          </>
        ) : (
          <>
            <p className="text-pretty text-[var(--color-text-secondary)]">
              {`No ${filterLabel.toLowerCase()} applications.`}
            </p>
            <button
              type="button"
              onClick={() => onFilterChange("ALL")}
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
        {applications.map((application) => (
          <li key={application.id}>
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
          {copy.headerLink.label}
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

      <div className="mt-6 flex flex-col gap-3">
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
            className={cn(secondaryButton, "min-h-10 px-5")}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </PageFrame>
  );
}
