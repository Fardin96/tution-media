"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { card, secondaryButton } from "@/components/profile/styles";
import { ApplicationActions } from "@/components/applications/application-actions";
import { BackLink } from "@/components/ui/back-link";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PageFrame } from "@/components/ui/page-frame";
import { PendingLabel } from "@/components/ui/pending-label";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import { areaName, formatDay } from "@/components/applications/format";
import { EmptyCard, ErrorBlock } from "@/components/browse/browse-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreas } from "@/lib/areas";
import { useEducationLookup } from "@/lib/education";
import { applicationQueryOptions, type Application } from "@/lib/applications";
import {
  packageLevelText,
  packageState,
  priceLabel,
  useMyPackage,
  usePackageRequests,
} from "@/lib/packages";
import { useIntentPrefetch } from "@/lib/prefetch";
import { ApiError } from "@/lib/profile";

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

function RequestCard({
  application,
  packageId,
}: {
  application: Application;
  packageId: string;
}) {
  const { student } = application;
  const { areas } = useAreas();
  const intent = useIntentPrefetch();
  return (
    <article className={cn(card, "flex flex-col gap-2 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
            {student.name}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {areaName(student.areaId, areas)}
          </p>
        </div>
        <StatusPill status={application.status} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
          {`Applied ${formatDay(application.appliedAt)}`}
        </p>
        <Link
          href={`/dashboard/applications/${application.id}?from=package-requests&package=${packageId}`}
          {...intent(applicationQueryOptions(application.id))}
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          <LinkPendingLabel>View request</LinkPendingLabel>
        </Link>
      </div>
      <ApplicationActions
        applicationId={application.id}
        allowedActions={application.allowedActions}
      />
    </article>
  );
}

export function PackageRequestsPage({ packageId }: { packageId: string }) {
  const packageQuery = useMyPackage(packageId);
  const requestsQuery = usePackageRequests(packageId);
  const { data: lookup } = useEducationLookup();

  const requests = useMemo(
    () => requestsQuery.data?.pages.flatMap((page) => page.applications) ?? [],
    [requestsQuery.data],
  );

  const pkg = packageQuery.data;
  const state = pkg ? packageState(pkg) : null;
  const title = pkg?.title ?? "Package requests";
  const subtitle = pkg
    ? `${packageLevelText(lookup, pkg)} · ${priceLabel(pkg.price)}`
    : null;

  const unavailable =
    isNotFound(packageQuery.error) || isNotFound(requestsQuery.error);

  let body: ReactNode;
  if (unavailable) {
    body = (
      <EmptyCard title="This package isn't available.">
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          It may have been removed, or it belongs to another tutor.
        </p>
      </EmptyCard>
    );
  } else if (requestsQuery.isPending) {
    body = (
      <div role="status" className="grid gap-4">
        <span className="sr-only">Loading requests…</span>
        {[0, 1].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(card, "flex flex-col gap-2 p-5")}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="grid gap-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-28 rounded-full" />
            </div>
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-10 w-24 rounded-full" />
              <Skeleton className="h-10 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (requestsQuery.isError) {
    body = (
      <ErrorBlock
        message="Couldn't load the requests."
        onRetry={() => void requestsQuery.refetch()}
      />
    );
  } else if (requests.length === 0) {
    body = (
      <EmptyCard
        title="No requests yet"
        body="Students see this package when they browse packages near them."
      />
    );
  } else {
    body = (
      <ul className="grid gap-4">
        {requests.map((application) => (
          <li key={application.id}>
            <RequestCard application={application} packageId={packageId} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <PageFrame>
      <div className="grid gap-6">
        <BackLink href="/dashboard/tutor/packages">Packages</BackLink>

        <header className="grid gap-2">
          <p className="text-sm font-semibold text-[var(--color-primary-core)]">
            Package
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
              {title}
            </h1>
            {state && <TonePill tone={state.tone}>{state.label}</TonePill>}
          </div>
          {subtitle && (
            <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
              {subtitle}
            </p>
          )}
          <p className="text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
            Students who asked to take this package. Accepting one declines the
            rest.
          </p>
        </header>

        {body}

        {requestsQuery.hasNextPage && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void requestsQuery.fetchNextPage()}
              disabled={requestsQuery.isFetchingNextPage}
              aria-busy={requestsQuery.isFetchingNextPage || undefined}
              className={cn(secondaryButton, "min-h-10 px-5")}
            >
              <PendingLabel pending={requestsQuery.isFetchingNextPage}>
                Load more
              </PendingLabel>
            </button>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
