"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  AdminDialog,
  DialogActions,
  Field,
  inputClass,
  textareaClass,
} from "@/components/admin/admin-ui";
import { BackLink } from "@/components/ui/back-link";
import { BlockingOverlay } from "@/components/ui/blocking-overlay";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PageFrame } from "@/components/ui/page-frame";
import { PendingLabel } from "@/components/ui/pending-label";
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
  REFUND_NOTE_MAX,
  TUTOR_REFUND_STATUS,
  validateRefundText,
} from "@/lib/admin-refunds";
import { errorCodeMessage } from "@/lib/api-errors";
import { applicationQueryOptions } from "@/lib/applications";
import { useIntentPrefetch } from "@/lib/prefetch";
import {
  useApplyPromo,
  useCheckout,
  useMyFee,
  useRemovePromo,
  useRequestRefund,
  type CheckoutQuote,
  type FeePromo,
  type TutorFeeDetail,
  type TutorRefund,
} from "@/lib/fees";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

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
  IN_REVIEW:
    "Online payment is paused while we check your earlier payment, listed above.",
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
      <BlockingOverlay
        open={pay.redirecting}
        label="Taking you to SSLCommerz…"
      />
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
                <LinkPendingLabel>Check that payment</LinkPendingLabel>
              </Link>
            </div>
          )}

          <div className="grid gap-3">
            <button
              type="button"
              aria-busy={pay.redirecting || undefined}
              disabled={pay.redirecting}
              onClick={() =>
                pay.mutate(undefined, {
                  onError: (err) =>
                    toastError("Couldn't start the payment.", err),
                })
              }
              className={cn(primaryButton, "self-start")}
            >
              <PendingLabel pending={pay.redirecting}>
                {`Pay ${formatMoney(checkout.totalAmount)} with SSLCommerz`}
              </PendingLabel>
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

function PromoForm({ feeId }: { feeId: string }) {
  const apply = useApplyPromo(feeId);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (apply.isPending) return;
    const trimmed = code.trim();
    if (trimmed === "") {
      setError("Enter a code.");
      return;
    }
    setError(undefined);
    apply.mutate(trimmed, {
      onSuccess: (detail) => {
        setCode("");
        toastSuccess(
          detail.status === "WAIVED"
            ? "Code applied. Nothing left to pay."
            : "Code applied.",
        );
      },
      onError: (err) => {
        // The code itself was refused (or the fee moved on): say so next to the field.
        if (
          err instanceof ApiError &&
          (err.status === 400 || err.status === 409)
        ) {
          setError(errorCodeMessage(err) ?? err.message);
          return;
        }
        toastError("Couldn't apply the code.", err);
      },
    });
  }

  return (
    <form onSubmit={submit}>
      <Field label="Promo code" error={error}>
        {({ id, describedBy, invalid }) => (
          <div className="flex flex-wrap gap-3">
            <input
              id={id}
              type="text"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setError(undefined);
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={32}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={describedBy}
              className={cn(inputClass, "min-w-0 flex-1 basis-48")}
            />
            <button
              type="submit"
              disabled={apply.isPending}
              aria-busy={apply.isPending || undefined}
              className={cn(secondaryButton, "shrink-0")}
            >
              <PendingLabel pending={apply.isPending}>Apply</PendingLabel>
            </button>
          </div>
        )}
      </Field>
    </form>
  );
}

function AppliedPromo({ feeId, promo }: { feeId: string; promo: FeePromo }) {
  const remove = useRemovePromo(feeId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
      <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
        <span className="font-semibold">{promo.code}</span> takes{" "}
        {formatMoney(promo.discountAmount)} off.
      </p>
      <button
        type="button"
        disabled={remove.isPending}
        aria-busy={remove.isPending || undefined}
        onClick={() =>
          remove.mutate(undefined, {
            onSuccess: () => toastSuccess("Code removed."),
            onError: (err) => toastError("Couldn't remove the code.", err),
          })
        }
        className={cn(ghostButton, "min-h-10 px-3")}
      >
        <PendingLabel pending={remove.isPending}>Remove code</PendingLabel>
      </button>
    </div>
  );
}

/** The form while no code is applied; the applied code (removable while nothing is paid) after. */
function PromoSection({ fee }: { fee: TutorFeeDetail }) {
  if (fee.promoAllowed) {
    return (
      <Section title="Promo code">
        <PromoForm feeId={fee.id} />
      </Section>
    );
  }
  if (fee.promo && fee.status === "DUE" && fee.amountPaid === "0.00") {
    return (
      <Section title="Promo code">
        <AppliedPromo feeId={fee.id} promo={fee.promo} />
      </Section>
    );
  }
  return null;
}

/** The payment a tutor is asking to refund. Kept after the dialog closes so its copy survives the exit animation. */
type RefundTarget = {
  paymentId: string;
  amount: string;
  refundableUntil: string;
};

/**
 * What a refund request would cover: the payment minus earlier refunds that went through. The
 * button only shows when no refund is open, so only SUCCEEDED ones count. Worked in cents.
 */
function refundableOf(
  paymentId: string,
  amount: string,
  fee: TutorFeeDetail,
): string {
  const refunded = fee.refunds
    .filter((r) => r.paymentId === paymentId && r.status === "SUCCEEDED")
    .reduce((cents, r) => cents + Math.round(Number(r.amount) * 100), 0);
  const left = Math.max(0, Math.round(Number(amount) * 100) - refunded);
  return (left / 100).toFixed(2);
}

function PaymentsSection({ fee }: { fee: TutorFeeDetail }) {
  const [refund, setRefund] = useState<RefundTarget>();
  const [refundOpen, setRefundOpen] = useState(false);

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
          const refundableUntil = payment.refundableUntil;
          return (
            <li
              key={payment.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
            >
              {/* flex-auto lets the text take the free space, so the amount and button sit at the end. */}
              <div className="min-w-0 flex-auto">
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
              {refundableUntil && (
                <button
                  type="button"
                  onClick={() => {
                    setRefund({
                      paymentId: payment.id,
                      amount: refundableOf(payment.id, payment.amount, fee),
                      refundableUntil,
                    });
                    setRefundOpen(true);
                  }}
                  className={cn(ghostButton, "ms-auto min-h-10 px-3")}
                >
                  Request a refund
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {refund && (
        <RefundDialog
          feeId={fee.id}
          target={refund}
          open={refundOpen}
          onOpenChange={setRefundOpen}
        />
      )}
    </Section>
  );
}

function RefundDialog({
  feeId,
  target,
  open,
  onOpenChange,
}: {
  feeId: string;
  target: RefundTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const request = useRequestRefund(feeId);
  const [serverError, setServerError] = useState<string>();

  function send(reason: string) {
    if (request.isPending) return;
    setServerError(undefined);
    request.mutate(
      { paymentId: target.paymentId, reason },
      {
        onSuccess: () => {
          onOpenChange(false);
          toastSuccess("Refund requested.");
        },
        onError: (err) => {
          // The server names the reason (window closed, already asked...). Keep the dialog open and say why.
          if (err instanceof ApiError && err.status === 409) {
            setServerError(errorCodeMessage(err) ?? err.message);
            return;
          }
          toastError("Couldn't request the refund.", err);
        },
      },
    );
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setServerError(undefined);
        onOpenChange(next);
      }}
      title="Ask for a refund?"
      description={`We refund the fee part (${formatMoney(target.amount)}). The processing charge isn't refunded. You can ask until ${formatDateTime(target.refundableUntil)}.`}
      busy={request.isPending}
    >
      <RefundForm
        pending={request.isPending}
        serverError={serverError}
        onCancel={() => onOpenChange(false)}
        onSubmit={send}
      />
    </AdminDialog>
  );
}

/** Mounted only while the dialog is open, so the reason starts empty each time. */
function RefundForm({
  pending,
  serverError,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  serverError?: string;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  // The reason is checked on submit, then as the tutor edits it.
  const error = attempted ? validateRefundText(reason) : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (validateRefundText(reason)) return;
    onSubmit(reason.trim());
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <Field label="Reason" error={error}>
        {({ id, describedBy, invalid }) => (
          <div className="grid gap-1.5">
            <textarea
              id={id}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={textareaClass}
            />
            <p className="text-end text-xs text-[var(--color-text-secondary)] tabular-nums">
              {reason.length}/{REFUND_NOTE_MAX}
            </p>
          </div>
        )}
      </Field>
      {serverError && (
        <p
          role="alert"
          className="text-sm text-pretty text-[var(--color-semantic-error-text)]"
        >
          {serverError}
        </p>
      )}
      <DialogActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={cn(secondaryButton, "min-h-11")}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={cn(primaryButton, "min-h-11")}
        >
          <PendingLabel pending={pending}>Send request</PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}

function RefundsSection({ refunds }: { refunds: TutorRefund[] }) {
  return (
    <Section title="Refunds">
      <ul className="grid gap-3">
        {refunds.map((refund) => {
          const status = TUTOR_REFUND_STATUS[refund.status];
          return (
            <li
              key={refund.id}
              className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
                  {formatMoney(refund.amount)}
                </p>
                <TonePill tone={status.tone}>{status.label}</TonePill>
              </div>
              <p className="text-sm text-pretty break-words text-[var(--color-neutral-charcoal)]">
                {refund.reason}
              </p>
              <p className="text-xs text-pretty text-[var(--color-text-secondary)] tabular-nums">
                Asked on {formatDateTime(refund.createdAt)}
                {refund.completedAt &&
                  ` · Done on ${formatDateTime(refund.completedAt)}`}
              </p>
              {refund.decisionNote && (
                <p className="text-sm text-pretty break-words text-[var(--color-text-secondary)]">
                  {refund.decisionNote}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/**
 * Money the gateway took that isn't on the fee yet: a payment being checked (REVIEW), or one that
 * couldn't be added and is waiting for its refund (UNAPPLIED). Shown so the tutor doesn't pay twice.
 */
function HeldPaymentsSection({
  feeId,
  held,
}: {
  feeId: string;
  held: TutorFeeDetail["heldPayments"];
}) {
  return (
    <Section title="Payments on hold">
      <ul className="grid gap-3">
        {held.map((payment) => (
          <li
            key={payment.tranId}
            className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
                {formatMoney(payment.totalAmount)}
              </p>
              <TonePill tone={payment.status === "REVIEW" ? "warning" : "info"}>
                {payment.status === "REVIEW"
                  ? "Being checked"
                  : "To be refunded"}
              </TonePill>
            </div>
            <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
              {payment.status === "REVIEW"
                ? "We're checking this payment. We'll add it to this fee or refund it, so don't pay again."
                : `This payment couldn't be added to this fee. We'll refund the fee part (${formatMoney(payment.feeAmount)}); the processing charge isn't refunded.`}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
              Paid on {formatDateTime(payment.createdAt)}
            </p>
            <Link
              href={`/dashboard/fees/${encodeURIComponent(feeId)}/payment?tran=${encodeURIComponent(payment.tranId)}`}
              className="text-sm font-semibold text-[var(--color-primary-core)] underline-offset-4 hover:underline"
            >
              <LinkPendingLabel>See this payment</LinkPendingLabel>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** A waived or void fee is no longer owed, whether or not a promo code is involved. */
function owesNothing(fee: Pick<TutorFeeDetail, "status">): boolean {
  return fee.status === "WAIVED" || fee.status === "VOID";
}

/**
 * The API keeps amount_due at the full fee when a code covers all of it, so a waived fee with a
 * promo shows the original amount less the discount. Done in cents to avoid float drift.
 */
function amountDueText(fee: TutorFeeDetail): string {
  if (!fee.promo || fee.status !== "WAIVED") return fee.amountDue;
  const cents =
    Math.round(Number(fee.promo.originalAmount) * 100) -
    Math.round(Number(fee.promo.discountAmount) * 100);
  return (cents / 100).toFixed(2);
}

function FeeBody({ fee }: { fee: TutorFeeDetail }) {
  const status = feeStatusDisplay(fee);
  const intent = useIntentPrefetch();
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
              ...(fee.promo
                ? [
                    {
                      label: "Original amount",
                      value: formatMoney(fee.promo.originalAmount),
                    },
                    {
                      label: `Promo ${fee.promo.code}`,
                      value: `−${formatMoney(fee.promo.discountAmount)}`,
                    },
                  ]
                : []),
              {
                label: "Amount due",
                value: formatMoney(amountDueText(fee)),
              },
              { label: "Paid", value: formatMoney(fee.amountPaid) },
              {
                label: "Remaining",
                value: formatMoney(owesNothing(fee) ? "0" : fee.remaining),
              },
              { label: "Due date", value: formatDay(fee.dueDate) },
              { label: "Confirmed on", value: confirmed },
              { label: "Student", value: fee.application.studentName },
              {
                label: "Package or requirement",
                value: fee.application.packageTitle ?? "Tuition requirement",
              },
            ]}
          />
          {fee.promo && fee.status === "WAIVED" && (
            <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
              Your promo code covered this fee.
            </p>
          )}
          <Link
            href={`/dashboard/applications/${encodeURIComponent(fee.application.id)}`}
            {...intent(applicationQueryOptions(fee.application.id))}
            className={cn(secondaryButton, "min-h-10 self-start px-4")}
          >
            <LinkPendingLabel>View application</LinkPendingLabel>
          </Link>
        </div>
      </Section>

      {fee.heldPayments.length > 0 && (
        <HeldPaymentsSection feeId={fee.id} held={fee.heldPayments} />
      )}

      <PromoSection fee={fee} />

      {fee.checkout !== null && (
        <PayOnlineSection
          feeId={fee.id}
          checkout={fee.checkout}
          pendingAttempt={fee.pendingAttempt}
        />
      )}

      <PaymentsSection fee={fee} />

      {fee.refunds.length > 0 && <RefundsSection refunds={fee.refunds} />}
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
