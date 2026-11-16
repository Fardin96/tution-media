"use client";

import Link from "next/link";
import { useRequestPackage } from "@/lib/applications";
import { usePackage } from "@/lib/browse";
import {
  curriculumOf,
  educationSummary,
  useEducationLookup,
} from "@/lib/education";
import { ApiError, AREAS, SUBJECTS, optionName } from "@/lib/profile";
import { formatTaka, formatTime } from "@/lib/requirements";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  BackLink,
  EmptyCard,
  ErrorBlock,
  RatingInline,
  SkeletonCards,
  TutorInitial,
} from "./browse-ui";
import { PageFrame } from "@/components/ui/page-frame";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import { formatDay } from "@/components/applications/format";

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

export function PackageDetailPage({ id }: { id: string }) {
  const query = usePackage(id);
  const request = useRequestPackage();
  const { data: lookup } = useEducationLookup();

  if (query.isPending) {
    return (
      <PageFrame>
        <BackLink href="/dashboard/find-tutors?tab=packages">
          Find tutors
        </BackLink>
        <div className="mt-6">
          <SkeletonCards label="Loading package" count={1} />
        </div>
      </PageFrame>
    );
  }

  if (query.isError) {
    return (
      <PageFrame>
        <BackLink href="/dashboard/find-tutors?tab=packages">
          Find tutors
        </BackLink>
        <div className="mt-6">
          {isNotFound(query.error) ? (
            <EmptyCard
              title="This package isn't available."
              body="It may have been removed, or it isn't open to students."
            >
              <Link
                href="/dashboard/find-tutors?tab=packages"
                className={cn(secondaryButton, "min-h-10 px-4")}
              >
                Back to packages
              </Link>
            </EmptyCard>
          ) : (
            <ErrorBlock
              message="Couldn't load this package."
              onRetry={() => void query.refetch()}
            />
          )}
        </div>
      </PageFrame>
    );
  }

  const pkg = query.data;
  const subject = optionName(SUBJECTS, pkg.subjectId);
  const curriculum = curriculumOf(lookup, pkg.curriculum)?.label;
  const level = educationSummary(lookup, pkg) || `Level ${pkg.levelCode}`;
  const place = pkg.areaId === null ? "Online" : optionName(AREAS, pkg.areaId);
  const mine = pkg.myApplication;

  function sendRequest() {
    request.mutate(pkg.id, {
      onSuccess: (application) => {
        toastSuccess(
          application
            ? "Request sent. The tutor will reply soon."
            : "You've already requested this package.",
        );
      },
      onError: (err) => {
        toastError("Couldn't send your request.", err);
      },
    });
  }

  return (
    <PageFrame>
      <BackLink href="/dashboard/find-tutors?tab=packages">
        Find tutors
      </BackLink>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
        {subject}
      </h1>
      <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
        {[curriculum, level].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          aria-labelledby="package-details"
          className={cn(card, "grid gap-5 p-5 sm:p-6")}
        >
          <h2
            id="package-details"
            className="font-semibold text-[var(--color-neutral-charcoal)]"
          >
            Package details
          </h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-sm text-[var(--color-text-secondary)]">
                Place
              </dt>
              <dd className="font-medium text-[var(--color-neutral-charcoal)]">
                {place}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-[var(--color-text-secondary)]">
                Schedule
              </dt>
              <dd className="font-medium text-[var(--color-neutral-charcoal)] tabular-nums">
                {pkg.daysPerWeek} days/week
                {pkg.timeOfDay && <> · {formatTime(pkg.timeOfDay)}</>}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-[var(--color-text-secondary)]">
                Salary
              </dt>
              <dd className="font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
                {formatTaka(pkg.expectedSalary)}
                <span className="font-normal text-[var(--color-text-secondary)]">
                  {" "}
                  / month
                </span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-[var(--color-text-secondary)]">
                Seats
              </dt>
              <dd className="font-medium text-[var(--color-neutral-charcoal)] tabular-nums">
                {pkg.studentCount} {pkg.studentCount === 1 ? "seat" : "seats"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-[var(--color-text-secondary)]">
                Available from
              </dt>
              <dd className="font-medium text-[var(--color-neutral-charcoal)]">
                {formatDay(pkg.availableFrom)}
              </dd>
            </div>
          </dl>
        </section>

        <aside
          aria-label="Tutor and request"
          className="grid content-start gap-4"
        >
          <section
            aria-labelledby="package-tutor"
            className={cn(card, "grid gap-4 p-5")}
          >
            <h2
              id="package-tutor"
              className="text-sm font-semibold text-[var(--color-text-secondary)]"
            >
              Tutor
            </h2>
            <div className="flex items-center gap-3">
              <TutorInitial name={pkg.tutor.name} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--color-neutral-charcoal)]">
                  {pkg.tutor.name}
                </p>
                <RatingInline
                  ratingAvg={pkg.tutor.ratingAvg}
                  ratingCount={pkg.tutor.ratingCount}
                />
              </div>
            </div>
          </section>

          <section
            aria-labelledby="package-request"
            className={cn(card, "grid gap-4 p-5")}
          >
            <h2 id="package-request" className="sr-only">
              Request this package
            </h2>

            {mine ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={mine.status} />
                </div>
                <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                  You&apos;ve already requested this package.
                </p>
                <Link
                  href={`/dashboard/applications/${mine.id}`}
                  className={cn(secondaryButton, "w-full")}
                >
                  View application
                </Link>
                <button
                  type="button"
                  disabled
                  className={cn(primaryButton, "w-full")}
                >
                  Request this package
                </button>
              </>
            ) : pkg.closed ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <TonePill tone="neutral">Application closed</TonePill>
                </div>
                <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                  This package isn&apos;t taking requests anymore.
                </p>
                <button
                  type="button"
                  disabled
                  className={cn(primaryButton, "w-full")}
                >
                  Request this package
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                  Send a request and the tutor will reply.
                </p>
                <button
                  type="button"
                  onClick={sendRequest}
                  disabled={request.isPending}
                  className={cn(primaryButton, "w-full")}
                >
                  {request.isPending ? "Sending…" : "Request this package"}
                </button>
              </>
            )}
          </section>
        </aside>
      </div>
    </PageFrame>
  );
}
