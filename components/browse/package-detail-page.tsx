"use client";

import Link from "next/link";
import { useRequestPackage } from "@/lib/applications";
import { usePackage } from "@/lib/browse";
import { useEducationLookup } from "@/lib/education";
import {
  COVERAGE_LABEL,
  durationLabel,
  packageLevelText,
  priceLabel,
} from "@/lib/packages";
import { ApiError } from "@/lib/profile";
import { daysSummary, formatTimeRange } from "@/lib/tutor-requirements";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  EmptyCard,
  ErrorBlock,
  RatingInline,
  SkeletonCards,
  TutorInitial,
} from "./browse-ui";
import { studentPlaceText } from "./package-card";
import { BackLink } from "@/components/ui/back-link";
import { useSubjects } from "@/lib/subjects";
import { TutorReviewList } from "@/components/reviews/review-list";
import { PageFrame } from "@/components/ui/page-frame";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import {
  admissionNamesText,
  curriculaText,
  formatDay,
  groupNamesText,
  studentsText,
  subjectNames,
} from "@/components/applications/format";

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

export function PackageDetailPage({ id }: { id: string }) {
  const query = usePackage(id);
  const request = useRequestPackage();
  const { data: lookup } = useEducationLookup();
  const { subjects } = useSubjects();

  if (query.isPending) {
    return (
      <PageFrame>
        <BackLink href="/dashboard/find-tutors?tab=packages">Packages</BackLink>
        <div className="mt-6">
          <SkeletonCards label="Loading package" count={1} />
        </div>
      </PageFrame>
    );
  }

  if (query.isError) {
    return (
      <PageFrame>
        <BackLink href="/dashboard/find-tutors?tab=packages">Packages</BackLink>
        <div className="mt-6">
          {isNotFound(query.error) ? (
            <EmptyCard
              title="This package isn't available."
              body="It may have been removed, or it isn't open to students."
            />
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
  const mine = pkg.myApplication;

  const details = [
    { label: "Coverage", value: COVERAGE_LABEL[pkg.coverage] },
    { label: "Duration", value: durationLabel(pkg.durationWeeks) },
    { label: "Price", value: `${priceLabel(pkg.price)} total` },
    { label: "Subjects", value: subjectNames(pkg.subjectIds, subjects) },
    {
      label: "Classes",
      value: [
        packageLevelText(lookup, pkg),
        curriculaText(lookup, pkg.curricula),
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      label: "Groups",
      value: groupNamesText(lookup, pkg.academicGroups),
    },
    {
      label: "Admission targets",
      value: admissionNamesText(lookup, pkg.admissionTargets),
    },
    {
      label: "Schedule",
      value: `${daysSummary(pkg)} · ${formatTimeRange(pkg.timeFrom, pkg.timeTo)}`,
    },
    { label: "Students", value: `Up to ${studentsText(pkg.maxStudents)}` },
    { label: "Place", value: studentPlaceText(pkg) },
    { label: "Available from", value: formatDay(pkg.availableFrom) },
  ].filter((row) => row.value !== "");

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
      <BackLink href="/dashboard/find-tutors?tab=packages">Packages</BackLink>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
        {pkg.title}
      </h1>
      <p className="mt-2 max-w-prose text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
        {pkg.description}
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
            {details.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-sm text-[var(--color-text-secondary)]">
                  {row.label}
                </dt>
                <dd className="font-medium text-pretty text-[var(--color-neutral-charcoal)] tabular-nums">
                  {row.value}
                </dd>
              </div>
            ))}
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
                  <Link
                    href={`/tutors/${pkg.tutor.id}`}
                    className="rounded-sm hover:underline"
                  >
                    {pkg.tutor.name}
                  </Link>
                </p>
                <RatingInline
                  ratingAvg={pkg.tutor.ratingAvg}
                  ratingCount={pkg.tutor.ratingCount}
                />
              </div>
            </div>
            <Link
              href={`/tutors/${pkg.tutor.id}`}
              className={cn(secondaryButton, "min-h-10 px-4")}
            >
              View profile
            </Link>
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

      <section
        aria-labelledby="package-reviews"
        className={cn(card, "mt-6 grid gap-4 p-5 sm:p-6")}
      >
        <h2
          id="package-reviews"
          className="font-semibold text-[var(--color-neutral-charcoal)]"
        >
          Reviews of {pkg.tutor.name}
        </h2>
        <TutorReviewList tutorId={pkg.tutor.id} />
      </section>
    </PageFrame>
  );
}
