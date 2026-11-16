"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { ApplicationActions } from "@/components/applications/application-actions";
import { PageFrame } from "@/components/ui/page-frame";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import {
  formatDay,
  showsClosedNote,
  targetRows,
  whatsappHref,
} from "@/components/applications/format";
import { Rows, Section } from "@/components/applications/detail-sections";
import {
  TutorProfileSection,
  TutorSetSection,
} from "@/components/applications/tutor-details";
import { useEducationLookup } from "@/lib/education";
import { ApiError, formatBdPhone } from "@/lib/profile";
import { formatTaka } from "@/lib/requirements";
import { useApplication, type ApplicationDetail } from "@/lib/applications";

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
      <Link
        href="/dashboard/applications"
        className={cn(secondaryButton, "min-h-10 px-4")}
      >
        Back to applications
      </Link>
    </div>
  );
}

export function ApplicationDetailPage({
  id,
  role,
}: {
  id: string;
  role: "TUTOR" | "STUDENT";
}) {
  const query = useApplication(id);
  const lookup = useEducationLookup();

  const backLink = (
    <Link
      href="/dashboard/applications"
      className={cn(secondaryButton, "min-h-10 self-start px-4")}
    >
      <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      Applications
    </Link>
  );

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
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          Try again
        </button>
      </div>
    );
  } else {
    const app = query.data;
    const isTutor = role === "TUTOR";
    const counterpart = isTutor ? app.student.name : app.tutor.name;
    const contact = app.counterpartContact;
    const fee = isTutor ? app.fee : null;
    const feeOpen =
      fee !== null && (fee.status === "DUE" || fee.status === "PARTIAL");

    body = (
      <div className="grid gap-6">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
                {counterpart}
              </h1>
            </div>
            <StatusPill status={app.status} />
          </div>
          {showsClosedNote(app) && (
            <TonePill tone="neutral" className="self-start">
              Application closed
            </TonePill>
          )}
          {app.allowedActions.length > 0 && (
            <ApplicationActions
              applicationId={app.id}
              allowedActions={app.allowedActions}
            />
          )}
        </header>

        <Section title="Tuition">
          <Rows rows={targetRows(lookup.data, app.target)} />
        </Section>

        {!isTutor && app.tutorProfile && (
          <TutorProfileSection profile={app.tutorProfile} />
        )}

        {!isTutor && app.tutorSet && (
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
              {fee.unpaid && (
                <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                  Payment is still open. Pay to keep your account in good
                  standing.
                </p>
              )}
              {feeOpen && (
                <div className="flex flex-col items-start gap-2">
                  <button
                    type="button"
                    disabled
                    className={cn(primaryButton, "min-h-10 px-4")}
                  >
                    Pay now
                  </button>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Online payment is coming soon.
                  </p>
                </div>
              )}
            </div>
          </Section>
        )}
      </div>
    );
  }

  return (
    <PageFrame>
      <div className="grid gap-6">
        {backLink}
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
