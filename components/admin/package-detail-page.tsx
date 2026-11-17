"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  primaryButton,
  card,
  secondaryButton,
} from "@/components/profile/styles";
import {
  AdminPage,
  DetailList,
  Section,
  StatusPill,
  type PillTone,
} from "@/components/admin/admin-ui";
import {
  ReviewDialog,
  VERIFICATION_LABEL,
  usePackageReview,
} from "@/components/admin/packages-page";
import {
  admissionNamesText,
  curriculaText,
  formatDay,
  genderLabel,
  groupNamesText,
  ratingText,
  studentsText,
  subjectNames,
} from "@/components/applications/format";
import { formatAmount, formatDateTime } from "@/lib/admin";
import { useAdminPackage, type AdminPackage } from "@/lib/admin-packages";
import { useEducationLookup } from "@/lib/education";
import {
  COVERAGE_LABEL,
  durationLabel,
  packageLevelText,
  packagePlaceText,
} from "@/lib/packages";
import { ApiError } from "@/lib/profile";
import { useSubjects } from "@/lib/subjects";
import { daysSummary, formatTimeRange } from "@/lib/tutor-requirements";

const MODERATION: Record<
  AdminPackage["moderationStatus"],
  { label: string; tone: PillTone }
> = {
  PENDING: { label: "Waiting for review", tone: "info" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "error" },
};

const LISTING_LABEL: Record<AdminPackage["status"], string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  FILLED: "Filled",
  CLOSED: "Closed",
  EXPIRED: "Expired",
};

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

export function AdminPackageDetailPage({ id }: { id: string }) {
  const query = useAdminPackage(id);
  const lookup = useEducationLookup();
  const { subjects } = useSubjects();
  const review = usePackageReview();

  const pkg = query.data;

  let body: ReactNode;
  if (query.isPending) {
    body = (
      <div role="status" className="grid gap-4">
        <span className="sr-only">Loading package</span>
        {[0, 1].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(
              card,
              "h-32 animate-pulse p-5 motion-reduce:animate-none",
            )}
          />
        ))}
      </div>
    );
  } else if (query.isError) {
    body = isNotFound(query.error) ? (
      <div className={cn(card, "p-6 text-center")}>
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          This package isn&apos;t available.
        </p>
        <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
          It may have been removed.
        </p>
      </div>
    ) : (
      <div
        className={cn(card, "flex flex-col items-center gap-3 p-6 text-center")}
      >
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          Couldn&apos;t load this package.
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className={secondaryButton}
        >
          Try again
        </button>
      </div>
    );
  } else if (pkg) {
    const moderation = MODERATION[pkg.moderationStatus];
    const reviewRows = [
      { label: "Submitted", value: formatDateTime(pkg.createdAt) },
      { label: "Last updated", value: formatDateTime(pkg.updatedAt) },
      { label: "Listing", value: LISTING_LABEL[pkg.status] },
      ...(pkg.moderationStatus === "REJECTED"
        ? [{ label: "Note for the tutor", value: pkg.moderationNote }]
        : []),
    ];
    const packageRows = [
      { label: "Coverage", value: COVERAGE_LABEL[pkg.coverage] },
      { label: "Duration", value: durationLabel(pkg.durationWeeks) },
      { label: "Total price", value: `${formatAmount(pkg.price)} total` },
      { label: "Subjects", value: subjectNames(pkg.subjectIds, subjects) },
      {
        label: "Classes",
        value: [
          packageLevelText(lookup.data, pkg),
          curriculaText(lookup.data, pkg.curricula),
        ]
          .filter(Boolean)
          .join(" · "),
      },
      {
        label: "Groups",
        value: groupNamesText(lookup.data, pkg.academicGroups),
      },
      {
        label: "Admission targets",
        value: admissionNamesText(lookup.data, pkg.admissionTargets),
      },
      {
        label: "Schedule",
        value: `${daysSummary(pkg)} · ${formatTimeRange(pkg.timeFrom, pkg.timeTo)}`,
      },
      { label: "Max students", value: studentsText(pkg.maxStudents) },
      { label: "Place", value: packagePlaceText(pkg) },
      { label: "Available from", value: formatDay(pkg.availableFrom) },
    ];

    body = (
      <>
        <Section
          title="Review"
          actions={
            <StatusPill tone={moderation.tone}>{moderation.label}</StatusPill>
          }
        >
          <DetailList items={reviewRows} />
        </Section>

        <Section title="Package">
          <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
            {pkg.description}
          </p>
          <DetailList items={packageRows} />
        </Section>

        <Section title="Tutor">
          <DetailList
            items={[
              { label: "Name", value: pkg.tutor.name },
              { label: "Gender", value: genderLabel(pkg.tutor.gender) },
              {
                label: "Rating",
                value:
                  pkg.tutor.ratingCount === 0
                    ? "No ratings yet"
                    : ratingText(pkg.tutor.ratingAvg, pkg.tutor.ratingCount),
              },
              {
                label: "Verification",
                value: VERIFICATION_LABEL[pkg.tutor.verificationStatus],
              },
              {
                label: "Listing",
                value: pkg.tutor.isListed ? (
                  "Listed"
                ) : (
                  <StatusPill tone="warning">Not listed</StatusPill>
                ),
              },
            ]}
          />
        </Section>
      </>
    );
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin/packages", label: "Packages" }}
      title={pkg?.title ?? "Package"}
      actions={
        pkg && pkg.moderationStatus === "PENDING" ? (
          <>
            <button
              type="button"
              onClick={() => review.start(pkg, "REJECT")}
              className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => review.start(pkg, "APPROVE")}
              className={cn(primaryButton, "min-h-11 sm:min-w-28")}
            >
              Approve
            </button>
          </>
        ) : undefined
      }
    >
      {body}
      <ReviewDialog review={review} />
    </AdminPage>
  );
}
