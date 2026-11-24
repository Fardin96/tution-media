"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { ApplicationActions } from "@/components/applications/application-actions";
import { BackLink } from "@/components/ui/back-link";
import { PageFrame } from "@/components/ui/page-frame";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import {
  formatDay,
  headingText,
  showsClosedNote,
  targetRows,
  whatsappHref,
} from "@/components/applications/format";
import { Rows, Section } from "@/components/applications/detail-sections";
import { StudentLocation } from "@/components/applications/student-location";
import {
  TutorProfileSection,
  TutorSetSection,
} from "@/components/applications/tutor-details";
import { ApplicationCaseActions } from "@/components/cases/application-case-actions";
import { ApplicationReviewSection } from "@/components/reviews/application-review-section";
import {
  StudentReviewList,
  TutorReviewList,
} from "@/components/reviews/review-list";
import { useEducationLookup } from "@/lib/education";
import { useAreas } from "@/lib/areas";
import { useSubjects } from "@/lib/subjects";
import { ApiError, formatBdPhone } from "@/lib/profile";
import { formatTaka } from "@/lib/requirements";
import { useApplication, type ApplicationDetail } from "@/lib/applications";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import { useIntentPrefetch } from "@/lib/prefetch";
import { VerifiedBadgeTip } from "@/components/ui/verified-badge";
import { adminFeeQueryOptions } from "@/lib/admin-fees";
import { myFeeQueryOptions } from "@/lib/fees";

type FeeStatus = NonNullable<ApplicationDetail["fee"]>["status"];

const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  DUE: "Due",
  PARTIAL: "Partly paid",
  PAID: "Paid",
  WAIVED: "Waived",
  VOID: "Void",
};

function DetailSkeleton() {
  return (
    <div role="status" className="grid gap-6">
      <span className="sr-only">Loading application</span>
      <div
        aria-hidden="true"
        className={cn(
          card,
          "h-40 animate-pulse p-5 motion-reduce:animate-none",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          card,
          "h-64 animate-pulse p-5 motion-reduce:animate-none",
        )}
      />
    </div>
  );
}

function NotFound() {
  return (
    <div className={cn(card, "flex flex-col items-start gap-3 p-6")}>
      <p className="font-semibold text-[var(--color-neutral-charcoal)]">
        We couldn&apos;t find that application.
      </p>
      <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
        It may have been removed. Check your list of applications.
      </p>
    </div>
  );
}

export function ApplicationDetailPage({
  id,
  role,
  from,
  packageId,
}: {
  id: string;
  /** ADMIN gets a read-only view: no actions, no contact details, and a link to the placement fee. */
  role: "TUTOR" | "STUDENT" | "ADMIN";
  /** "applicants" when opened from a requirement's applicants list, "package-requests" from a package's requests list. */
  from?: "applicants" | "package-requests";
  /** The package whose requests list the page was opened from. */
  packageId?: string;
}) {
  const query = useApplication(id);
  const lookup = useEducationLookup();
  const { subjects } = useSubjects();
  const { areas } = useAreas();
  const intent = useIntentPrefetch();

  // Back returns to the applicants list only when we came from there and the
  // target is a requirement (the applicants list is keyed by requirement id).
  const back =
    role === "ADMIN"
      ? { href: "/dashboard/admin/applications", label: "Applications" }
      : from === "applicants" && query.data?.target.kind === "REQUIREMENT"
        ? {
            href: `/dashboard/requirements/${query.data.target.id}/applicants`,
            label: "Applicants",
          }
        : from === "package-requests" &&
            packageId &&
            query.data?.target.kind === "PACKAGE"
          ? {
              href: `/dashboard/tutor/packages/${encodeURIComponent(packageId)}/requests`,
              label: "Requests",
            }
          : { href: "/dashboard/applications", label: "Applications" };

  let body: ReactNode;
  if (query.isPending) {
    body = <DetailSkeleton />;
  } else if (query.isError) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;
    body = notFound ? (
      <NotFound />
    ) : (
      <div
        role="alert"
        className={cn(card, "flex flex-col items-start gap-3 p-6")}
      >
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          Couldn&apos;t load this application.
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
  } else {
    const app = query.data;
    const isTutor = role === "TUTOR";
    const isAdmin = role === "ADMIN";
    const counterpart = isTutor
      ? app.student.name
      : isAdmin
        ? `${app.tutor.name} → ${app.student.name}`
        : app.tutor.name;
    const heading = headingText(app.target, counterpart);
    const counterpartVerified = isAdmin
      ? false
      : isTutor
        ? app.student.verifiedBadge
        : app.tutor.verifiedBadge;
    const badge = counterpartVerified ? <VerifiedBadgeTip size={20} /> : null;
    const contact = app.counterpartContact;
    const fee = isTutor || isAdmin ? app.fee : null;
    const feeOpen =
      isTutor &&
      fee !== null &&
      (fee.status === "DUE" || fee.status === "PARTIAL");

    body = (
      <div className="grid gap-6">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center">
                <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
                  {heading}
                </h1>
                {heading === counterpart && badge}
              </div>
              {heading !== counterpart && (
                <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
                  {counterpart}
                  {badge}
                </p>
              )}
            </div>
            <StatusPill status={app.status} />
          </div>
          {showsClosedNote(app) && (
            <TonePill tone="neutral" className="self-start">
              Application closed
            </TonePill>
          )}
          {!isAdmin && app.allowedActions.length > 0 && (
            <ApplicationActions
              applicationId={app.id}
              allowedActions={app.allowedActions}
            />
          )}
        </header>

        <Section title="Tuition">
          <Rows rows={targetRows(lookup.data, app.target, subjects, areas)} />
        </Section>

        {role === "STUDENT" && app.tutorProfile && (
          <TutorProfileSection profile={app.tutorProfile} />
        )}

        {role === "STUDENT" && app.tutorSet && (
          <TutorSetSection tutorSet={app.tutorSet} lookup={lookup.data} />
        )}

        <Section title="Timeline">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <TimelineItem label="Applied" value={formatDay(app.appliedAt)} />
            {app.confirmedAt && (
              <TimelineItem
                label="Confirmed"
                value={formatDay(app.confirmedAt)}
              />
            )}
            {app.endedAt && (
              <TimelineItem label="Ended" value={formatDay(app.endedAt)} />
            )}
          </dl>
        </Section>

        {!isAdmin && (
          <Section title="Contact">
            {contact ? (
              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${contact.phoneNumber}`}
                  className={cn(secondaryButton, "min-h-10 px-4")}
                >
                  {formatBdPhone(contact.phoneNumber)}
                </a>
                {contact.whatsappNumber && (
                  <a
                    href={whatsappHref(contact.whatsappNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(secondaryButton, "min-h-10 px-4")}
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                Contact details appear once the application is accepted.
              </p>
            )}
          </Section>
        )}

        {app.studentLocation && (
          <Section title="Student's location">
            <StudentLocation location={app.studentLocation} />
          </Section>
        )}

        {!isAdmin && (
          <>
            <ApplicationReviewSection application={app} viewerRole={role} />
            <Section title={`Reviews of ${counterpart}`}>
              {isTutor ? (
                <StudentReviewList studentId={app.student.id} />
              ) : (
                <TutorReviewList tutorId={app.tutor.id} />
              )}
            </Section>
          </>
        )}

        {fee && (
          <Section title="Placement fee">
            <div className="grid gap-4">
              <dl className="grid gap-3 sm:grid-cols-3">
                <TimelineItem
                  label="Amount due"
                  value={formatTaka(Number(fee.amountDue))}
                />
                <TimelineItem
                  label="Paid"
                  value={formatTaka(Number(fee.amountPaid))}
                />
                <TimelineItem label="Due date" value={formatDay(fee.dueDate)} />
              </dl>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-neutral-charcoal)]">
                <span className="font-medium">Status</span>
                <TonePill tone={fee.unpaid ? "error" : "neutral"}>
                  {fee.unpaid ? "Unpaid" : FEE_STATUS_LABEL[fee.status]}
                </TonePill>
              </div>
              {isAdmin && (
                <Link
                  href={`/dashboard/admin/fees/${encodeURIComponent(fee.id)}`}
                  {...intent(adminFeeQueryOptions(fee.id))}
                  className={cn(secondaryButton, "min-h-10 self-start px-4")}
                >
                  <LinkPendingLabel>Open fee</LinkPendingLabel>
                </Link>
              )}
              {fee.unpaid && isTutor && (
                <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                  Payment is still open. Pay to keep your account in good
                  standing.
                </p>
              )}
              {feeOpen && (
                <Link
                  href={`/dashboard/fees/${encodeURIComponent(fee.id)}`}
                  {...intent(myFeeQueryOptions(fee.id))}
                  className={cn(primaryButton, "min-h-10 self-start px-4")}
                >
                  <LinkPendingLabel>Pay now</LinkPendingLabel>
                </Link>
              )}
            </div>
          </Section>
        )}

        {!isAdmin && (
          <ApplicationCaseActions application={app} viewerRole={role} />
        )}
      </div>
    );
  }

  return (
    <PageFrame>
      <div className="grid gap-6">
        <BackLink href={back.href}>{back.label}</BackLink>
        {body}
      </div>
    </PageFrame>
  );
}

function TimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
      <dt className="text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-[var(--color-neutral-charcoal)] tabular-nums">
        {value}
      </dd>
    </div>
  );
}
