"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
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
import { FieldError } from "@/components/profile/profile-fields";
import {
  AdminDialog,
  AdminPage,
  DetailList,
  DialogActions,
  Field,
  QueryState,
  Section,
  StatusPill,
  inputClass,
  textareaClass,
} from "@/components/admin/admin-ui";
import {
  FEE_STATUS_META,
  adminFeeQueryOptions,
  type FeeTone,
} from "@/lib/admin-fees";
import { ATTEMPT_STATUS_META } from "@/lib/admin-payments";
import {
  REFUND_NOTE_MAX,
  REFUND_STATUS_META,
  useAdminRefund,
  useApproveRefund,
  useCheckRefund,
  useRejectRefund,
  useResolveRefund,
  validateRefundText,
  type AdminRefundDetail,
  type ResolveRefundBody,
} from "@/lib/admin-refunds";
import { formatAmount, formatDateTime, useAdminMe } from "@/lib/admin";
import { errorCodeMessage } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";
import { useIntentPrefetch } from "@/lib/prefetch";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";

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

function isConflict(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409;
}

/** The toast for what the gateway said about a refund that was just sent. Shared with the payment page. */
export function toastRefundSent(detail: AdminRefundDetail) {
  if (detail.status === "NEEDS_REVIEW") {
    toast.warning(
      "The gateway didn't answer clearly. Check the merchant panel.",
    );
    return;
  }
  if (detail.status === "FAILED") {
    toast.error(detail.failureReason ?? "The gateway refused the refund.");
    return;
  }
  toast.success("Refund sent to the gateway.");
}

const SOURCE_LABEL: Record<AdminRefundDetail["source"], string> = {
  TUTOR: "Tutor asked",
  ADMIN: "Admin started",
};

type Dialog = "APPROVE" | "DECLINE" | "RESOLVE";

export function AdminRefundDetailPage({ id }: { id: string }) {
  const query = useAdminRefund(id);
  const approve = useApproveRefund(id);
  const decline = useRejectRefund(id);
  const check = useCheckRefund(id);
  const resolve = useResolveRefund(id);
  const admin = useAdminMe();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const intent = useIntentPrefetch();

  const detail = query.data;
  const isSuperAdmin = admin.isSuperAdmin;
  const busy = approve.isPending || decline.isPending || resolve.isPending;

  function closeDialog() {
    if (!busy) setDialog(null);
  }

  function runCheck() {
    if (!detail) return;
    const before = detail.status;
    check.mutate(undefined, {
      onSuccess: (next) => {
        toast.success(
          next.status === before
            ? "No change at the gateway yet."
            : `Refund is now ${REFUND_STATUS_META[next.status].label}.`,
        );
      },
      onError: (err) =>
        toast.error(failureText(err, "Couldn't check the refund.")),
    });
  }

  function submitApprove(note: string) {
    approve.mutate(note || undefined, {
      onSuccess: (next) => {
        toastRefundSent(next);
        setDialog(null);
      },
      onError: (err) => {
        toast.error(failureText(err, "Couldn't send the refund."));
        if (isConflict(err)) setDialog(null);
      },
    });
  }

  function submitDecline(note: string) {
    decline.mutate(note, {
      onSuccess: () => {
        toast.success("Refund declined.");
        setDialog(null);
      },
      onError: (err) => {
        toast.error(failureText(err, "Couldn't decline the refund."));
        if (isConflict(err)) setDialog(null);
      },
    });
  }

  function submitResolve(body: ResolveRefundBody) {
    resolve.mutate(body, {
      onSuccess: () => {
        toast.success("Refund resolved.");
        setDialog(null);
      },
      onError: (err) => {
        toast.error(failureText(err, "Couldn't resolve the refund."));
        if (isConflict(err)) setDialog(null);
      },
    });
  }

  // A super admin's decision takes the primary slot; otherwise Check is the main action.
  const decidesHere =
    isSuperAdmin &&
    detail !== undefined &&
    (detail.canApprove || detail.canReject || detail.canResolve);

  return (
    <AdminPage
      back={{ href: "/dashboard/admin/refunds", label: "Refunds" }}
      title="Refund"
      description={detail && <RefundHeader detail={detail} />}
      actions={
        detail ? (
          <>
            {detail.canApprove && isSuperAdmin && (
              <button
                type="button"
                onClick={() => setDialog("APPROVE")}
                className={cn(primaryButton, "min-h-11")}
              >
                Approve
              </button>
            )}
            {detail.canResolve && isSuperAdmin && (
              <button
                type="button"
                onClick={() => setDialog("RESOLVE")}
                className={cn(primaryButton, "min-h-11")}
              >
                Resolve
              </button>
            )}
            {detail.canReject && isSuperAdmin && (
              <button
                type="button"
                onClick={() => setDialog("DECLINE")}
                className={cn(
                  secondaryButton,
                  "min-h-11 text-[var(--color-semantic-error-text)]",
                )}
              >
                Decline
              </button>
            )}
            {detail.canCheck && (
              <button
                type="button"
                onClick={runCheck}
                disabled={check.isPending}
                aria-busy={check.isPending || undefined}
                className={cn(
                  decidesHere ? secondaryButton : primaryButton,
                  "min-h-11",
                )}
              >
                <PendingLabel pending={check.isPending}>
                  Check with gateway
                </PendingLabel>
              </button>
            )}
            {(detail.canApprove || detail.canReject || detail.canResolve) &&
              admin.isSuccess &&
              !isSuperAdmin && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  A super admin decides refunds.
                </p>
              )}
          </>
        ) : undefined
      }
    >
      <QueryState
        query={query}
        isEmpty={!detail}
        loadingLabel="Loading refund"
        errorText="Couldn't load this refund."
        emptyText="This refund could not be found."
        skeletonCount={2}
      >
        {detail && (
          <>
            {detail.failureReason && (
              <Callout tone={REFUND_STATUS_META[detail.status].tone}>
                {detail.failureReason}
              </Callout>
            )}
            {detail.status === "SUCCEEDED" && detail.reversalId && (
              <Callout tone="warning">
                The fee is due again. Waive it from the fee page if the tutor
                shouldn&apos;t pay.
              </Callout>
            )}

            <Section title="Refund">
              <DetailList
                items={[
                  { label: "Amount", value: formatAmount(detail.amount) },
                  { label: "Source", value: SOURCE_LABEL[detail.source] },
                  { label: "Reason", value: detail.reason },
                  { label: "Requested by", value: detail.requestedByName },
                  { label: "Decided by", value: detail.decidedByName },
                  { label: "Decision note", value: detail.decisionNote },
                  {
                    label: "Gateway refund reference",
                    value: detail.refundRefId && (
                      <span className="font-mono break-all">
                        {detail.refundRefId}
                      </span>
                    ),
                  },
                  { label: "Created", value: formatDateTime(detail.createdAt) },
                  {
                    label: "Decided",
                    value: detail.decidedAt
                      ? formatDateTime(detail.decidedAt)
                      : null,
                  },
                  {
                    label: "Completed",
                    value: detail.completedAt
                      ? formatDateTime(detail.completedAt)
                      : null,
                  },
                  {
                    label: "Last checked",
                    value: detail.lastCheckedAt
                      ? formatDateTime(detail.lastCheckedAt)
                      : "Never",
                  },
                ]}
              />
            </Section>

            <Section title="Payment">
              <DetailList
                items={[
                  {
                    label: "Transaction ID",
                    value: (
                      <Link
                        href={`/dashboard/admin/payments/${encodeURIComponent(detail.attempt.tranId)}`}
                        className={cn(
                          "font-mono break-all text-[var(--color-primary-core)] underline-offset-4 hover:underline",
                          focusRing,
                        )}
                      >
                        {detail.attempt.tranId}
                      </Link>
                    ),
                  },
                  {
                    label: "Payment status",
                    value: ATTEMPT_STATUS_META[detail.attempt.status].label,
                  },
                  {
                    label: "Fee part",
                    value: formatAmount(detail.attempt.feeAmount),
                  },
                  {
                    label: "Total paid",
                    value: formatAmount(detail.attempt.totalAmount),
                  },
                  {
                    label: "Bank transaction ID",
                    value: detail.attempt.bankTranId && (
                      <span className="font-mono break-all">
                        {detail.attempt.bankTranId}
                      </span>
                    ),
                  },
                ]}
              />
            </Section>

            <Section
              title="Fee"
              actions={
                <Link
                  href={`/dashboard/admin/fees/${encodeURIComponent(detail.fee.id)}`}
                  {...intent(adminFeeQueryOptions(detail.fee.id))}
                  className={cn(ghostButton, "min-h-10")}
                >
                  <LinkPendingLabel>Open fee</LinkPendingLabel>
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
              if (!open) closeDialog();
            }}
            busy={approve.isPending}
            title="Approve this refund?"
            description="This sends the refund to SSLCommerz now. The processing charge isn't refunded."
          >
            <NoteForm
              optional
              label="Note"
              submitLabel="Approve refund"
              saving={approve.isPending}
              onCancel={closeDialog}
              onSubmit={submitApprove}
            />
          </AdminDialog>

          <AdminDialog
            open={dialog === "DECLINE"}
            onOpenChange={(open) => {
              if (!open) closeDialog();
            }}
            busy={decline.isPending}
            title="Decline this refund?"
            description="Nothing is sent to the gateway. The tutor sees the refund as declined."
          >
            <NoteForm
              label="Note"
              submitLabel="Decline refund"
              destructive
              saving={decline.isPending}
              onCancel={closeDialog}
              onSubmit={submitDecline}
            />
          </AdminDialog>

          <AdminDialog
            open={dialog === "RESOLVE"}
            onOpenChange={(open) => {
              if (!open) closeDialog();
            }}
            busy={resolve.isPending}
            title="Resolve this refund by hand?"
            description="Check the SSLCommerz merchant panel first. Then record what happened."
          >
            <ResolveForm
              saving={resolve.isPending}
              onCancel={closeDialog}
              onSubmit={submitResolve}
            />
          </AdminDialog>
        </>
      )}
    </AdminPage>
  );
}

function RefundHeader({ detail }: { detail: AdminRefundDetail }) {
  const meta = REFUND_STATUS_META[detail.status];
  return (
    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      <span>{meta.hint}</span>
    </span>
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

/** One note field and a submit. `optional` lets an empty note through. Submits the trimmed note ("" when empty). */
function NoteForm({
  label,
  optional = false,
  submitLabel,
  destructive = false,
  saving,
  onCancel,
  onSubmit,
}: {
  label: string;
  optional?: boolean;
  submitLabel: string;
  destructive?: boolean;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const trimmed = note.trim();
  const noteError =
    optional && trimmed === "" ? undefined : validateRefundText(note);

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (noteError) return;
    onSubmit(trimmed);
  }

  return (
    <form noValidate onSubmit={onFormSubmit} className="grid gap-5">
      <Field
        label={label}
        hint={
          optional
            ? `Optional. ${note.length}/${REFUND_NOTE_MAX}`
            : `${note.length}/${REFUND_NOTE_MAX}`
        }
        error={submitted ? noteError : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            rows={3}
            maxLength={REFUND_NOTE_MAX}
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
            destructive
              ? cn(secondaryButton, "text-[var(--color-semantic-error-text)]")
              : primaryButton,
            "min-h-11 sm:min-w-36",
          )}
        >
          <PendingLabel pending={saving}>{submitLabel}</PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}

const OUTCOMES: { value: ResolveRefundBody["outcome"]; label: string }[] = [
  { value: "SUCCEEDED", label: "The money was refunded" },
  { value: "FAILED", label: "No refund happened" },
];

function ResolveForm({
  saving,
  onCancel,
  onSubmit,
}: {
  saving: boolean;
  onCancel: () => void;
  onSubmit: (body: ResolveRefundBody) => void;
}) {
  const groupId = useId();
  const outcomeErrorId = `${groupId}-error`;
  const [outcome, setOutcome] = useState<ResolveRefundBody["outcome"] | null>(
    null,
  );
  const [refundRefId, setRefundRefId] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const outcomeError =
    outcome === null ? "Choose what happened at the gateway." : undefined;
  const noteError = validateRefundText(note);

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (outcome === null || noteError) return;
    const reference = refundRefId.trim();
    onSubmit({
      outcome,
      note: note.trim(),
      // The reference only applies to a refund that went through.
      ...(outcome === "SUCCEEDED" && reference
        ? { refundRefId: reference }
        : {}),
    });
  }

  return (
    <form noValidate onSubmit={onFormSubmit} className="grid gap-5">
      <fieldset
        className="grid gap-2"
        aria-describedby={
          submitted && outcome === null ? outcomeErrorId : undefined
        }
      >
        <legend className="mb-1.5 text-sm font-semibold text-[var(--color-neutral-charcoal)]">
          What happened at the gateway?
        </legend>
        {OUTCOMES.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4 text-sm font-medium text-[var(--color-neutral-charcoal)]"
          >
            <input
              type="radio"
              name={groupId}
              value={option.value}
              checked={outcome === option.value}
              onChange={() => setOutcome(option.value)}
              className="size-4 accent-[var(--color-primary-core)]"
            />
            {option.label}
          </label>
        ))}
        <FieldError
          id={outcomeErrorId}
          message={submitted ? outcomeError : undefined}
        />
      </fieldset>

      {outcome === "SUCCEEDED" && (
        <Field
          label="Gateway refund reference (optional)"
          hint="The refund ID from the merchant panel, if you have it."
        >
          {({ id, describedBy }) => (
            <input
              id={id}
              type="text"
              autoComplete="off"
              value={refundRefId}
              onChange={(e) => setRefundRefId(e.target.value)}
              aria-describedby={describedBy}
              className={cn(inputClass, "font-mono")}
            />
          )}
        </Field>
      )}

      <Field
        label="Note"
        hint={`${note.length}/${REFUND_NOTE_MAX}`}
        error={submitted ? noteError : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            rows={3}
            maxLength={REFUND_NOTE_MAX}
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
          className={cn(primaryButton, "min-h-11 sm:min-w-36")}
        >
          <PendingLabel pending={saving}>Resolve refund</PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}
