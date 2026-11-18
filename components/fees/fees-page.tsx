"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  card,
  focusRing,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { BackLink } from "@/components/ui/back-link";
import { PageFrame } from "@/components/ui/page-frame";
import { TonePill } from "@/components/applications/status-pill";
import { formatDay } from "@/components/applications/format";
import { EmptyCard, ErrorBlock } from "@/components/browse/browse-ui";
import { feeStatusDisplay, formatMoney } from "@/components/fees/fee-format";
import { isFeeOpen, useMyFees, type TutorFee } from "@/lib/fees";

function SkeletonRows({ count }: { count: number }) {
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">Loading placement fees</span>
      {Array.from({ length: count }, (_, i) => (
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
}

function Amount({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--color-neutral-charcoal)] tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function FeeRow({ fee }: { fee: TutorFee }) {
  const status = feeStatusDisplay(fee);
  const open = isFeeOpen(fee);
  const what = fee.application.packageTitle ?? "Tuition requirement";

  return (
    <Link
      href={`/dashboard/fees/${encodeURIComponent(fee.id)}`}
      className={cn(
        card,
        "grid gap-4 p-5 transition-[background-color] duration-150 ease-out hover:bg-[var(--color-neutral-off-white)] motion-reduce:transition-none",
        focusRing,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
            {fee.application.studentName}
          </h2>
          <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
            {what}
          </p>
        </div>
        <TonePill tone={status.tone}>{status.label}</TonePill>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Amount label="Amount due" value={formatMoney(fee.amountDue)} />
        {fee.status === "PARTIAL" && (
          <Amount label="Remaining" value={formatMoney(fee.remaining)} />
        )}
        <Amount label="Due date" value={formatDay(fee.dueDate)} />
      </dl>
      {open && (
        <span className={cn(primaryButton, "min-h-10 self-start px-4")}>
          Pay
        </span>
      )}
    </Link>
  );
}

export function FeesPage() {
  const fees = useMyFees();

  const list = useMemo(
    () => fees.data?.pages.flatMap((page) => page.fees) ?? [],
    [fees.data],
  );

  let body: ReactNode;
  if (fees.isPending) {
    body = <SkeletonRows count={3} />;
  } else if (fees.isError) {
    body = (
      <ErrorBlock
        message="Couldn't load your placement fees."
        onRetry={() => void fees.refetch()}
      />
    );
  } else if (list.length === 0) {
    body = (
      <EmptyCard
        title="No placement fees yet."
        body="You'll see one here after a student confirms you."
      />
    );
  } else {
    body = (
      <ul className="grid gap-4">
        {list.map((fee) => (
          <li key={fee.id}>
            <FeeRow fee={fee} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <PageFrame>
      <div className="grid gap-6">
        <BackLink href="/dashboard">Dashboard</BackLink>

        <header className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
            Placement fees
          </h1>
          <p className="text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
            What you owe Tuition Media for each confirmed tuition, and what
            you&apos;ve paid.
          </p>
        </header>

        {body}

        {fees.hasNextPage && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void fees.fetchNextPage()}
              disabled={fees.isFetchingNextPage}
              className={cn(secondaryButton, "min-h-10 px-5")}
            >
              {fees.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
