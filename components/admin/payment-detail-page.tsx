"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  card,
  focusRing,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  AdminDialog,
  AdminPage,
  DetailList,
  DialogActions,
  Field,
  QueryState,
  Section,
  StatusPill,
  textareaClass,
} from "@/components/admin/admin-ui";
import { FEE_STATUS_META, type FeeTone } from "@/lib/admin-fees";
import {
  ATTEMPT_STATUS_META,
  NOTE_MAX,
  useAdminPaymentAttempt,
  useCheckPaymentAttempt,
  useReviewPaymentAttempt,
  validateNote,
  type AdminPaymentAttemptDetail,
  type ReviewDecision,
} from "@/lib/admin-payments";
import { formatAmount, formatDateTime, useAdminMe } from "@/lib/admin";
import { errorCodeMessage } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";

/** The server's message for a 409, the catalogue copy for a known code, a short server message, or the fallback. */
function failureText(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 409 && err.message) {
    return err.message;
  }
  const known = errorCodeMessage(err);
  if (known) return known;
  if (err instanceof ApiError && err.status < 500 && err.message) {
    return err.message;
  }
  return fallback;
}

function riskLabel(level: number | null): string {
  if (level === null) return "–";
  if (level === 0) return "Low";
  if (level === 1) return "High";
  return String(level);
}

export function AdminPaymentDetailPage({ tranId }: { tranId: string }) {
  const query = useAdminPaymentAttempt(tranId);
  const check = useCheckPaymentAttempt(tranId);
  const review = useReviewPaymentAttempt(tranId);
  const admin = useAdminMe();
  const [dialog, setDialog] = useState<ReviewDecision | null>(null);

  const detail = query.data;
  const isSuperAdmin = admin.isSuperAdmin;

  function runCheck() {
    if (!detail) return;
    const before = detail.status;
    check.mutate(undefined, {
      onSuccess: (next) => {
        toast.success(
          next.status === before
            ? "No change at the gateway yet."
            : `Payment is now ${ATTEMPT_STATUS_META[next.status].label}.`,
        );
      },
      onError: (err) =>
        toast.error(failureText(err, "Couldn't check the payment.")),
    });
  }

  function submitReview(decision: ReviewDecision, note: string) {
    review.mutate(
      { decision, note },
      {
        onSuccess: () => {
          toast.success(
            decision === "APPROVE" ? "Payment approved." : "Payment rejected.",
          );
          setDialog(null);
        },
        onError: (err) => {
          toast.error(failureText(err, "Couldn't save the decision."));
          // 409: the payment was already decided. The refreshed detail shows the outcome.
          if (err instanceof ApiError && err.status === 409) setDialog(null);
        },
      },
    );
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin/payments", label: "Payments" }}
      title="Online payment"
      description={detail && <AttemptHeader detail={detail} />}
      actions={
        detail ? (
          <>
            {detail.canCheck && (
              <button
                type="button"
                onClick={runCheck}
                disabled={check.isPending}
                aria-busy={check.isPending || undefined}
                className={cn(
                  detail.canReview ? secondaryButton : primaryButton,
                  "min-h-11",
                )}
              >
                {check.isPending ? "Checking…" : "Check with gateway"}
              </button>
            )}
            {detail.canReview && isSuperAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setDialog("APPROVE")}
                  className={cn(primaryButton, "min-h-11")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setDialog("REJECT")}
                  className={cn(
                    secondaryButton,
                    "min-h-11 text-[var(--color-semantic-error-text)]",
                  )}
                >
                  Reject
                </button>
              </>
            )}
            {detail.canReview && admin.isSuccess && !isSuperAdmin && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                A super admin decides flagged payments.
              </p>
            )}
          </>
        ) : undefined
      }
    >
      <QueryState
        query={query}
        isEmpty={!detail}
        loadingLabel="Loading payment"
        errorText="Couldn't load this payment."
        emptyText="This payment could not be found."
        skeletonCount={2}
      >
        {detail && (
          <>
            {detail.failureReason && (
              <Callout tone={ATTEMPT_STATUS_META[detail.status].tone}>
                {detail.failureReason}
              </Callout>
            )}

            <Section title="Amounts">
              <DetailList
                items={[
                  { label: "Total", value: formatAmount(detail.totalAmount) },
                  { label: "Fee part", value: formatAmount(detail.feeAmount) },
                  {
                    label: "Processing charge",
                    value: formatAmount(detail.chargeAmount),
                  },
                ]}
              />
            </Section>

            <Section
              title="Fee"
              actions={
                <Link
                  href={`/dashboard/admin/fees/${encodeURIComponent(detail.fee.id)}`}
                  className={cn(ghostButton, "min-h-10")}
                >
                  Open fee
                </Link>
              }
            >
              <DetailList
                items={[
                  { label: "Tutor", value: detail.tutor.name },
                  {
                    label: "Fee status",
                    value: (
                      <StatusPill
                        tone={FEE_STATUS_META[detail.fee.status].tone}
                      >
                        {FEE_STATUS_META[detail.fee.status].label}
                      </StatusPill>
                    ),
                  },
                  {
                    label: "Amount due",
                    value: formatAmount(detail.fee.amountDue),
                  },
                  { label: "Paid", value: formatAmount(detail.fee.amountPaid) },
                ]}
              />
            </Section>

            <Section title="Gateway">
              <DetailList
                items={[
                  { label: "Bank transaction ID", value: detail.bankTranId },
                  { label: "Card type", value: detail.cardType },
                  { label: "Validation ID", value: detail.valId },
                  { label: "Risk level", value: riskLabel(detail.riskLevel) },
                  {
                    label: "Started",
                    value: formatDateTime(detail.createdAt),
                  },
                  {
                    label: "Last checked",
                    value: detail.lastCheckedAt
                      ? formatDateTime(detail.lastCheckedAt)
                      : "Never",
                  },
                  {
                    label: "Settled",
                    value: detail.settledAt
                      ? formatDateTime(detail.settledAt)
                      : "–",
                  },
                ]}
              />
            </Section>

            {detail.gatewayResponse && (
              <RawResponse value={detail.gatewayResponse} />
            )}
          </>
        )}
      </QueryState>

      {detail && (
        <>
          <AdminDialog
            open={dialog === "APPROVE"}
            onOpenChange={(open) => {
              if (!open && !review.isPending) setDialog(null);
            }}
            busy={review.isPending}
            title="Approve this payment?"
            description="Approve only after you've confirmed the money in the SSLCommerz merchant panel. The fee part is added to the fee."
          >
            <ReviewForm
              decision="APPROVE"
              saving={review.isPending}
              onCancel={() => setDialog(null)}
              onSubmit={(note) => submitReview("APPROVE", note)}
            />
          </AdminDialog>

          <AdminDialog
            open={dialog === "REJECT"}
            onOpenChange={(open) => {
              if (!open && !review.isPending) setDialog(null);
            }}
            busy={review.isPending}
            title="Reject this payment?"
            description="The payment stays with the gateway and is marked not applied, so it can be refunded."
          >
            <ReviewForm
              decision="REJECT"
              saving={review.isPending}
              onCancel={() => setDialog(null)}
              onSubmit={(note) => submitReview("REJECT", note)}
            />
          </AdminDialog>
        </>
      )}
    </AdminPage>
  );
}

function AttemptHeader({ detail }: { detail: AdminPaymentAttemptDetail }) {
  const meta = ATTEMPT_STATUS_META[detail.status];
  return (
    <>
      <span className="block font-mono text-sm break-all text-[var(--color-neutral-charcoal)]">
        {detail.tranId}
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        <span>{meta.hint}</span>
      </span>
    </>
  );
}

const CALLOUT_TONE: Record<FeeTone, string> = {
  neutral:
    "bg-[var(--color-neutral-off-white)] text-[var(--color-neutral-charcoal)]",
  info: "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]",
  success:
    "bg-[var(--color-semantic-success-surface)] text-[var(--color-semantic-success-text)]",
  warning:
    "bg-[var(--color-semantic-warning-surface)] text-[var(--color-semantic-warning-text)]",
  error:
    "bg-[var(--color-semantic-error-surface)] text-[var(--color-semantic-error-text)]",
};

function Callout({ tone, children }: { tone: FeeTone; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[16px] p-4 text-sm font-medium text-pretty",
        CALLOUT_TONE[tone],
      )}
    >
      {children}
    </div>
  );
}

function RawResponse({ value }: { value: Record<string, unknown> }) {
  return (
    <details className={cn(card, "min-w-0 p-5 sm:p-6")}>
      <summary
        className={cn(
          "cursor-pointer rounded-md text-base font-semibold text-[var(--color-neutral-charcoal)] select-none",
          focusRing,
        )}
      >
        Raw gateway response
      </summary>
      <pre
        tabIndex={0}
        className={cn(
          "mt-4 overflow-x-auto rounded-[16px] bg-[var(--color-neutral-off-white)] p-4 font-mono text-xs leading-relaxed text-[var(--color-neutral-charcoal)]",
          focusRing,
        )}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function ReviewForm({
  decision,
  saving,
  onCancel,
  onSubmit,
}: {
  decision: ReviewDecision;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const noteError = validateNote(note);
  const approve = decision === "APPROVE";

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (noteError) return;
    onSubmit(note.trim());
  }

  return (
    <form noValidate onSubmit={onFormSubmit} className="grid gap-5">
      <Field
        label="Note"
        hint={`${note.length}/${NOTE_MAX}`}
        error={submitted ? noteError : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={textareaClass}
          />
        )}
      </Field>
      <DialogActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving || undefined}
          className={cn(
            approve
              ? primaryButton
              : cn(secondaryButton, "text-[var(--color-semantic-error-text)]"),
            "min-h-11 sm:min-w-36",
          )}
        >
          {saving ? "Saving…" : approve ? "Approve payment" : "Reject payment"}
        </button>
      </DialogActions>
    </form>
  );
}
