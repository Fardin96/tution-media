"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { card, secondaryButton } from "@/components/profile/styles";
import { ApplicationActions } from "@/components/applications/application-actions";
import { PageFrame } from "@/components/ui/page-frame";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import {
  formatDay,
  genderLabel,
  ratingText,
} from "@/components/applications/format";
import { useRequirementApplicants, type Application } from "@/lib/applications";

function ApplicantCard({ application }: { application: Application }) {
  const { tutor } = application;
  return (
    <article className={cn(card, "flex flex-col gap-4 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
            {tutor.name}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            {[
              tutor.ratingCount > 0
                ? `Rated ${ratingText(tutor.ratingAvg, tutor.ratingCount)}`
                : "No ratings yet",
              genderLabel(tutor.gender),
            ].join(" · ")}
          </p>
        </div>
        <StatusPill status={application.status} />
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
        {`Applied ${formatDay(application.appliedAt)}`}
      </p>
      <ApplicationActions
        applicationId={application.id}
        allowedActions={application.allowedActions}
      />
    </article>
  );
}

function ApplicantsSkeleton() {
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">Loading applicants</span>
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(
            card,
            "h-44 animate-pulse p-5 motion-reduce:animate-none",
          )}
        />
      ))}
    </div>
  );
}

export function RequirementApplicantsPage({
  requirementId,
}: {
  requirementId: string;
}) {
  const query = useRequirementApplicants(requirementId);

  const applicants = useMemo(
    () => query.data?.pages.flatMap((page) => page.applications) ?? [],
    [query.data],
  );
  const hired = applicants.some((a) => a.status === "CONFIRMED");

  let body: ReactNode;
  if (query.isPending) {
    body = <ApplicantsSkeleton />;
  } else if (query.isError) {
    body = (
      <div
        role="alert"
        className={cn(card, "flex flex-col items-start gap-3 p-6")}
      >
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          Couldn&apos;t load the applicants.
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
  } else if (applicants.length === 0) {
    body = (
      <div className={cn(card, "flex flex-col items-start gap-3 p-6")}>
        <p className="text-pretty text-[var(--color-text-secondary)]">
          No tutors have applied to this tuition yet.
        </p>
        <Link
          href="/dashboard"
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          Back to dashboard
        </Link>
      </div>
    );
  } else {
    body = (
      <ul className="grid gap-4">
        {applicants.map((application) => (
          <li key={application.id}>
            <ApplicantCard application={application} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <PageFrame>
      <div className="grid gap-6">
        <Link
          href="/dashboard"
          className={cn(secondaryButton, "min-h-10 self-start px-4")}
        >
          <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          Dashboard
        </Link>

        <header className="grid gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
              Applicants
            </h1>
            {hired && <TonePill tone="success">Tutor hired</TonePill>}
          </div>
          <p className="text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
            {hired
              ? "You accepted a tutor for this tuition. Other applicants were declined automatically."
              : "Accept the tutor you want. Decline the rest."}
          </p>
        </header>

        {body}

        {query.hasNextPage && (
          <div className="flex justify-center">
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
      </div>
    </PageFrame>
  );
}
