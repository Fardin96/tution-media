"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  card,
  ghostButton,
  secondaryButton,
} from "@/components/profile/styles";
import { BackLink } from "@/components/ui/back-link";
import { PageFrame } from "@/components/ui/page-frame";
import { TonePill } from "@/components/applications/status-pill";
import { formatDay } from "@/components/applications/format";
import { EmptyCard, ErrorBlock } from "@/components/browse/browse-ui";
import {
  CASE_STATUS_META,
  DISPUTE_TYPE_LABEL,
  REPORT_CATEGORY_LABEL,
  useMyDisputes,
  useMyReports,
  type CaseStatus,
} from "@/lib/cases";

const COLLAPSED_LENGTH = 140;

function SkeletonRows() {
  return (
    <div role="status" className="grid gap-3">
      <span className="sr-only">Loading</span>
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(
            card,
            "h-28 animate-pulse p-5 motion-reduce:animate-none",
          )}
        />
      ))}
    </div>
  );
}

function CaseRow({
  title,
  status,
  createdAt,
  counterpart,
  counterpartLabel,
  details,
  resolutionNote,
}: {
  title: string;
  status: CaseStatus;
  createdAt: string;
  counterpart: string | null;
  counterpartLabel: string;
  details: string;
  resolutionNote: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const meta = CASE_STATUS_META[status];
  const long = details.length > COLLAPSED_LENGTH;
  const shown =
    long && !expanded
      ? `${details.slice(0, COLLAPSED_LENGTH).trimEnd()}…`
      : details;

  return (
    <li className={cn(card, "grid gap-3 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h3 className="min-w-0 text-base font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
          {title}
        </h3>
        <TonePill tone={meta.tone}>{meta.label}</TonePill>
      </div>
      <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
        {counterpartLabel} {counterpart ?? "a user"} · {formatDay(createdAt)}
      </p>
      <div className="grid justify-items-start gap-1">
        <p
          id={detailsId}
          className="text-sm break-words whitespace-pre-line text-[var(--color-neutral-charcoal)]"
        >
          {shown}
        </p>
        {long && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded((value) => !value)}
            className={cn(ghostButton, "-ms-3 min-h-10 px-3")}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
      {resolutionNote && (
        <div className="rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Admin note
          </p>
          <p className="mt-1 text-sm break-words whitespace-pre-line text-[var(--color-neutral-charcoal)]">
            {resolutionNote}
          </p>
        </div>
      )}
    </li>
  );
}

function Group<T>({
  title,
  query,
  items,
  emptyTitle,
  emptyBody,
  errorMessage,
  children,
}: {
  title: string;
  query: {
    isPending: boolean;
    isError: boolean;
    refetch: () => unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
  };
  items: T[];
  emptyTitle: string;
  emptyBody: string;
  errorMessage: string;
  children: (item: T) => ReactNode;
}) {
  const headingId = useId();
  let body: ReactNode;
  if (query.isPending) {
    body = <SkeletonRows />;
  } else if (query.isError) {
    body = (
      <ErrorBlock message={errorMessage} onRetry={() => void query.refetch()} />
    );
  } else if (items.length === 0) {
    body = <EmptyCard title={emptyTitle} body={emptyBody} />;
  } else {
    body = <ul className="grid gap-3">{items.map(children)}</ul>;
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <h2
        id={headingId}
        className="text-lg font-semibold text-[var(--color-neutral-charcoal)]"
      >
        {title}
      </h2>
      {body}
      {query.hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className={cn(secondaryButton, "min-h-10 px-5")}
          >
            {query.isFetchingNextPage ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </section>
  );
}

export function ReportsPage() {
  const disputes = useMyDisputes();
  const reports = useMyReports();

  const disputeList = useMemo(
    () => disputes.data?.pages.flatMap((page) => page.disputes) ?? [],
    [disputes.data],
  );
  const reportList = useMemo(
    () => reports.data?.pages.flatMap((page) => page.reports) ?? [],
    [reports.data],
  );

  return (
    <PageFrame>
      <div className="grid gap-8">
        <div className="grid gap-6">
          <BackLink href="/dashboard">Dashboard</BackLink>
          <header className="grid gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
              Reports and disputes
            </h1>
            <p className="text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
              Everything you&apos;ve raised, and where it stands. Start a new
              one from the tuition&apos;s page.
            </p>
          </header>
        </div>

        <Group
          title="Disputes"
          query={disputes}
          items={disputeList}
          emptyTitle="No disputes."
          emptyBody="If a confirmed tuition goes wrong, you can open one from its page."
          errorMessage="Couldn't load your disputes."
        >
          {(dispute) => (
            <CaseRow
              key={dispute.id}
              title={DISPUTE_TYPE_LABEL[dispute.type]}
              status={dispute.status}
              createdAt={dispute.createdAt}
              counterpartLabel="Against"
              counterpart={dispute.against.name}
              details={dispute.details}
              resolutionNote={dispute.resolutionNote}
            />
          )}
        </Group>

        <Group
          title="Reports"
          query={reports}
          items={reportList}
          emptyTitle="No reports."
          emptyBody="You can report the other person from any tuition's page."
          errorMessage="Couldn't load your reports."
        >
          {(report) => (
            <CaseRow
              key={report.id}
              title={REPORT_CATEGORY_LABEL[report.category]}
              status={report.status}
              createdAt={report.createdAt}
              counterpartLabel="About"
              counterpart={report.target.name}
              details={report.details}
              resolutionNote={report.resolutionNote}
            />
          )}
        </Group>
      </div>
    </PageFrame>
  );
}
