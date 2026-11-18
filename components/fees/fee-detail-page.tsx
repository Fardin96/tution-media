"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/components/profile/styles";
import { BackLink } from "@/components/ui/back-link";
import { PageFrame } from "@/components/ui/page-frame";
import { TonePill } from "@/components/applications/status-pill";
import { formatDay } from "@/components/applications/format";
import { Rows, Section } from "@/components/applications/detail-sections";
import { EmptyCard, ErrorBlock } from "@/components/browse/browse-ui";
import {
  feeStatusDisplay,
  formatMoney,
  formatPercent,
  paymentMethodText,
} from "@/components/fees/fee-format";
import { formatDateTime } from "@/lib/admin";
import {
  useCheckout,
  useMyFee,
  type CheckoutQuote,
  type TutorFeeDetail,
} from "@/lib/fees";
import { ApiError } from "@/lib/profile";
import { toastError } from "@/lib/toast";

function DetailSkeleton() {
  return (
    <div role="status" className="grid gap-6">
      <span className="sr-only">Loading placement fee</span>
      <div
        aria-hidden="true"
        className="h-48 animate-pulse rounded-[24px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="h-40 animate-pulse rounded-[24px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none"
      />
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  strong = false,
  className,
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
        className,
      )}
    >
      <dt
        className={cn(
          "text-sm text-pretty text-[var(--color-neutral-charcoal)]",
          strong && "font-semibold",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm text-[var(--color-neutral-charcoal)] tabular-nums",
          strong && "font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Why the tutor can't pay online. Anything unknown falls back to the general line. */
const UNAVAILABLE_COPY: Record<
  NonNullable<CheckoutQuote["unavailableReason"]> | "DEFAULT",
  string
> = {
  PAYMENTS_OFF:
    "Online payment is turned off right now. You can still pay the Tuition Media team in cash.",
  BELOW_MINIMUM: "Online payments start at ৳10. Pay the rest in cash.",
  DEFAULT:
    "Online payment isn't available for this fee right now. You can still pay the Tuition Media team in cash.",
};

function PayOnlineSection({
  feeId,
  checkout,
  pendingAttempt,
}: {
  feeId: string;
  checkout: CheckoutQuote;
  pendingAttempt: TutorFeeDetail["pendingAttempt"];
}) {
  const pay = useCheckout(feeId);
  const showCharge = Number(checkout.chargeAmount) !== 0;

  return (
    <Section title="Pay online">
      {checkout.enabled ? (
        <div className="grid gap-5">
          <dl className="grid gap-2">
            <BreakdownRow
              label="Placement fee"
              value={formatMoney(checkout.feeAmount)}
            />
            {showCharge && (
              <BreakdownRow
                label={`Processing charge (${formatPercent(checkout.chargePercent)}%)`}
                value={formatMoney(checkout.chargeAmount)}
              />
            )}
            <BreakdownRow
              label="Total"
              value={formatMoney(checkout.totalAmount)}
              strong
              className="mt-1"
            />
          </dl>

          {pendingAttempt && (
            <div className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
              <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
                A payment you started at{" "}
                {formatDateTime(pendingAttempt.createdAt)} is still open. If you
                finished it, it&apos;ll show here in a minute.
              </p>
              <Link
                href={`/dashboard/fees/${encodeURIComponent(feeId)}/payment?tran=${encodeURIComponent(pendingAttempt.tranId)}`}
                className="text-sm font-semibold text-[var(--color-primary-core)] underline-offset-4 hover:underline"
              >
                Check that payment
              </Link>
            </div>
          )}

          <div className="grid gap-3">
            <button
              type="button"
              aria-busy={pay.isPending}
              disabled={pay.isPending}
              onClick={() =>
                pay.mutate(undefined, {
                  onError: (err) =>
                    toastError("Couldn't start the payment.", err),
                })
              }
              className={cn(primaryButton, "self-start")}
            >
              {pay.isPending
                ? "Opening SSLCommerz…"
                : `Pay ${formatMoney(checkout.totalAmount)} with SSLCommerz`}
            </button>
            <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
              You&apos;ll finish on SSLCommerz&apos;s secure page and come back
              here. The processing charge covers the gateway&apos;s fee and
              isn&apos;t refunded.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          {UNAVAILABLE_COPY[checkout.unavailableReason ?? "DEFAULT"]}
        </p>
      )}
    </Section>
  );
}

function PaymentsSection({ fee }: { fee: TutorFeeDetail }) {
  if (fee.payments.length === 0) {
    return (
      <Section title="Payments">
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          No payments yet.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Payments">
      <ul className="grid gap-3">
        {fee.payments.map((payment) => {
          const reversal = payment.kind === "REVERSAL";
          const method = paymentMethodText(payment.method);
          return (
            <li
              key={payment.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-neutral-charcoal)]">
                  {reversal ? "Reversed" : method}
                </p>
                <p className="mt-0.5 text-xs text-pretty text-[var(--color-text-secondary)] tabular-nums">
                  {formatDateTime(payment.receivedAt)}
                  {reversal && ` · ${method}`}
                </p>
              </div>
              <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
                {reversal
                  ? `−${formatMoney(payment.amount)}`
                  : formatMoney(payment.amount)}
              </p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function FeeBody({ fee }: { fee: TutorFeeDetail }) {
  const status = feeStatusDisplay(fee);
  const confirmed = fee.application.confirmedAt
    ? formatDay(fee.application.confirmedAt)
    : "Not confirmed yet";

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <p className="text-sm font-semibold text-[var(--color-primary-core)]">
          Placement fee
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
          {fee.application.studentName}
        </h1>
      </header>

      <Section title="Summary">
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-neutral-charcoal)]">
            <span className="font-medium">Status</span>
            <TonePill tone={status.tone}>{status.label}</TonePill>
          </div>
          <Rows
            rows={[
              { label: "Amount due", value: formatMoney(fee.amountDue) },
              { label: "Paid", value: formatMoney(fee.amountPaid) },
              { label: "Remaining", value: formatMoney(fee.remaining) },
              { label: "Due date", value: formatDay(fee.dueDate) },
              { label: "Confirmed on", value: confirmed },
              { label: "Student", value: fee.application.studentName },
              {
                label: "Package or requirement",
                value: fee.application.packageTitle ?? "Tuition requirement",
              },
            ]}
          />
          <Link
            href={`/dashboard/applications/${encodeURIComponent(fee.application.id)}`}
            className={cn(secondaryButton, "min-h-10 self-start px-4")}
          >
            View application
          </Link>
        </div>
      </Section>

      {fee.checkout !== null && (
        <PayOnlineSection
          feeId={fee.id}
          checkout={fee.checkout}
          pendingAttempt={fee.pendingAttempt}
        />
      )}

      <PaymentsSection fee={fee} />
    </div>
  );
}

export function FeeDetailPage({ feeId }: { feeId: string }) {
  const query = useMyFee(feeId);

  let body: ReactNode;
  if (query.isPending) {
    body = <DetailSkeleton />;
  } else if (query.isError) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;
    body = notFound ? (
      <EmptyCard
        title="We couldn't find that fee."
        body="It may have been removed, or it belongs to another account."
      />
    ) : (
      <ErrorBlock
        message="Couldn't load this placement fee."
        onRetry={() => void query.refetch()}
      />
    );
  } else {
    body = <FeeBody fee={query.data} />;
  }

  return (
    <PageFrame>
      <div className="grid gap-6">
        <BackLink href="/dashboard/fees">Fees</BackLink>
        {body}
      </div>
    </PageFrame>
  );
}
