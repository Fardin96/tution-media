"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
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
  inputClass,
  textareaClass,
} from "@/components/admin/admin-ui";
import { formatAmount, formatDateTime } from "@/lib/admin";
import {
  FEE_STATUS_META,
  FEE_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  REASON_MAX,
  REASON_MIN,
  formatDueDate,
  localDateTimeToIso,
  localDateTimeValue,
  parseAmount,
  useAdminFee,
  useRecordPayment,
  useReversePayment,
  useUpdateFee,
  validateAmount,
  validateReason,
  type AdminFeeDetail,
  type AdminFeePayment,
  type RecordPaymentBody,
  type ReversePaymentBody,
  type UpdateFeeBody,
} from "@/lib/admin-fees";
import { toastError, toastSuccess } from "@/lib/toast";

type Dialog =
  | { kind: "record" }
  | { kind: "reverse"; payment: AdminFeePayment }
  | { kind: "waive" }
  | { kind: "void" };

/** A payment can be reversed while some of it is left and the fee still takes payments. */
function reversibleAmount(
  fee: AdminFeeDetail,
  payment: AdminFeePayment,
): string | null {
  if (payment.kind !== "PAYMENT") return null;
  if (fee.status === "WAIVED" || fee.status === "VOID") return null;
  const left = Number(payment.amount) - Number(payment.reversedAmount);
  return left > 0 ? left.toFixed(2) : null;
}

export function AdminFeeDetailPage({ id }: { id: string }) {
  const query = useAdminFee(id);
  const update = useUpdateFee(id);
  const record = useRecordPayment(id);
  const reverse = useReversePayment(id);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const fee = query.data;
  const busy = update.isPending || record.isPending || reverse.isPending;
  const canRecord =
    fee !== undefined && (fee.status === "DUE" || fee.status === "PARTIAL");
  const canVoid =
    fee !== undefined &&
    Number(fee.amountPaid) === 0 &&
    fee.status !== "VOID" &&
    fee.status !== "PAID";

  function closeDialog() {
    if (!busy) setDialog(null);
  }

  function saveEdit(body: UpdateFeeBody) {
    update.mutate(body, {
      onSuccess: () => toastSuccess("Fee updated"),
      onError: (err) => toastError("Couldn't update the fee.", err),
    });
  }

  function setStatus(status: "WAIVED" | "VOID") {
    update.mutate(
      { status },
      {
        onSuccess: () => {
          toastSuccess(status === "WAIVED" ? "Fee waived" : "Fee voided");
          setDialog(null);
        },
        onError: (err) =>
          toastError(
            status === "WAIVED"
              ? "Couldn't waive the fee."
              : "Couldn't void the fee.",
            err,
          ),
      },
    );
  }

  function submitPayment(body: RecordPaymentBody) {
    record.mutate(body, {
      onSuccess: () => {
        toastSuccess("Payment recorded");
        setDialog(null);
      },
      onError: (err) => toastError("Couldn't record the payment.", err),
    });
  }

  function submitReversal(paymentId: string, body: ReversePaymentBody) {
    reverse.mutate(
      { paymentId, body },
      {
        onSuccess: () => {
          toastSuccess("Payment reversed");
          setDialog(null);
        },
        onError: (err) => toastError("Couldn't reverse the payment.", err),
      },
    );
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin/fees", label: "Fees" }}
      title={fee ? `${FEE_TYPE_LABEL[fee.feeType]} fee` : "Fee"}
      description={fee ? `${fee.tutor.name} → ${fee.student.name}` : undefined}
      actions={
        fee ? (
          <>
            {canRecord && (
              <button
                type="button"
                onClick={() => setDialog({ kind: "record" })}
                className={cn(primaryButton, "min-h-11")}
              >
                Record payment
              </button>
            )}
            {canRecord && (
              <button
                type="button"
                onClick={() => setDialog({ kind: "waive" })}
                className={cn(secondaryButton, "min-h-11")}
              >
                Waive
              </button>
            )}
            {canVoid && (
              <button
                type="button"
                onClick={() => setDialog({ kind: "void" })}
                className={cn(secondaryButton, "min-h-11")}
              >
                Void
              </button>
            )}
          </>
        ) : undefined
      }
    >
      <QueryState
        query={query}
        isEmpty={!fee}
        loadingLabel="Loading fee"
        errorText="Couldn't load this fee."
        emptyText="This fee could not be found."
        skeletonCount={2}
      >
        {fee && (
          <>
            <FeeSection fee={fee} />

            <Section title="Payments">
              {fee.payments.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No payments recorded yet.
                </p>
              ) : (
                <ol className="grid gap-3">
                  {[...fee.payments]
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                    .map((payment) => {
                      const reversible = reversibleAmount(fee, payment);
                      return (
                        <PaymentRow
                          key={payment.id}
                          payment={payment}
                          onReverse={
                            reversible
                              ? () => setDialog({ kind: "reverse", payment })
                              : undefined
                          }
                        />
                      );
                    })}
                </ol>
              )}
            </Section>

            <EditSection
              key={`${fee.id}-${fee.updatedAt}`}
              fee={fee}
              saving={update.isPending}
              onSave={saveEdit}
            />
          </>
        )}
      </QueryState>

      {fee && (
        <>
          <AdminDialog
            open={dialog?.kind === "record"}
            onOpenChange={(open) => {
              if (!open) closeDialog();
            }}
            busy={busy}
            title="Record payment"
            description="Cash payments only. Enter what the tutor paid in cash."
          >
            <RecordPaymentForm
              remaining={fee.remaining}
              saving={record.isPending}
              onCancel={closeDialog}
              onSubmit={submitPayment}
            />
          </AdminDialog>

          <AdminDialog
            open={dialog?.kind === "reverse"}
            onOpenChange={(open) => {
              if (!open) closeDialog();
            }}
            busy={busy}
            title="Reverse payment"
            description="The payment stays on the ledger. A reversal is added beside it."
          >
            {dialog?.kind === "reverse" && (
              <ReversePaymentForm
                key={dialog.payment.id}
                reversible={reversibleAmount(fee, dialog.payment) ?? "0"}
                saving={reverse.isPending}
                onCancel={closeDialog}
                onSubmit={(body) => submitReversal(dialog.payment.id, body)}
              />
            )}
          </AdminDialog>

          <AdminDialog
            open={dialog?.kind === "waive"}
            onOpenChange={(open) => {
              if (!open) closeDialog();
            }}
            busy={busy}
            title="Waive this fee?"
            description="The tutor no longer owes this fee."
          >
            <ConfirmActions
              label="Waive fee"
              pending={update.isPending}
              onCancel={closeDialog}
              onConfirm={() => setStatus("WAIVED")}
            />
          </AdminDialog>

          <AdminDialog
            open={dialog?.kind === "void"}
            onOpenChange={(open) => {
              if (!open) closeDialog();
            }}
            busy={busy}
            title="Void this fee?"
            description="Use this when the fee was created by mistake."
          >
            <ConfirmActions
              label="Void fee"
              destructive
              pending={update.isPending}
              onCancel={closeDialog}
              onConfirm={() => setStatus("VOID")}
            />
          </AdminDialog>
        </>
      )}
    </AdminPage>
  );
}

function FeeSection({ fee }: { fee: AdminFeeDetail }) {
  const meta = FEE_STATUS_META[fee.status];
  return (
    <Section title="Fee">
      <DetailList
        items={[
          { label: "Type", value: FEE_TYPE_LABEL[fee.feeType] },
          {
            label: "Status",
            value: (
              <span className="inline-flex flex-wrap gap-2">
                <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                {fee.overdue && <StatusPill tone="error">Overdue</StatusPill>}
              </span>
            ),
          },
          { label: "Amount due", value: formatAmount(fee.amountDue) },
          { label: "Paid", value: formatAmount(fee.amountPaid) },
          { label: "Remaining", value: formatAmount(fee.remaining) },
          { label: "Due date", value: formatDueDate(fee.dueDate) },
          { label: "Created", value: formatDateTime(fee.createdAt) },
          {
            label: "Tuition",
            value: fee.application.packageTitle ?? "Requirement",
          },
          { label: "Note", value: fee.note },
          {
            label: "Application",
            value: (
              <Link
                href={`/dashboard/applications/${encodeURIComponent(fee.application.id)}?from=admin`}
                className={cn(
                  "font-semibold text-[var(--color-primary-core)] underline-offset-4 hover:underline",
                  focusRing,
                )}
              >
                Open application
              </Link>
            ),
          },
        ]}
      />
    </Section>
  );
}

function PaymentRow({
  payment,
  onReverse,
}: {
  payment: AdminFeePayment;
  onReverse?: () => void;
}) {
  const isReversal = payment.kind === "REVERSAL";
  const reversedSome = !isReversal && Number(payment.reversedAmount) > 0;
  return (
    <li className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
            {isReversal ? "Reversal" : "Payment"} ·{" "}
            {isReversal
              ? `−${formatAmount(payment.amount)}`
              : formatAmount(payment.amount)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] tabular-nums">
            {formatDateTime(payment.receivedAt)} ·{" "}
            {PAYMENT_METHOD_LABEL[payment.method]} · {payment.recordedByName}
          </p>
        </div>
        {onReverse && (
          <button
            type="button"
            onClick={onReverse}
            className={cn(ghostButton, "min-h-10 px-3")}
          >
            Reverse
          </button>
        )}
      </div>
      {payment.txnReference && (
        <p className="text-sm break-words text-[var(--color-neutral-charcoal)]">
          Reference {payment.txnReference}
        </p>
      )}
      {payment.reason && (
        <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
          {payment.reason}
        </p>
      )}
      {reversedSome && (
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          {formatAmount(payment.reversedAmount)} reversed
        </p>
      )}
    </li>
  );
}

function EditSection({
  fee,
  saving,
  onSave,
}: {
  fee: AdminFeeDetail;
  saving: boolean;
  onSave: (body: UpdateFeeBody) => void;
}) {
  const initialDue = fee.dueDate.slice(0, 10);
  const initialNote = (fee.note ?? "").trim();
  const [dueDate, setDueDate] = useState(initialDue);
  const [note, setNote] = useState(fee.note ?? "");
  const [submitted, setSubmitted] = useState(false);

  const dueMissing = dueDate === "";
  const trimmedNote = note.trim();
  const dirty = dueDate !== initialDue || trimmedNote !== initialNote;

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (dueMissing || !dirty) return;
    // Only changed fields go out. An empty note clears it.
    const body: UpdateFeeBody = {};
    if (dueDate !== initialDue) body.dueDate = dueDate;
    if (trimmedNote !== initialNote) {
      body.note = trimmedNote === "" ? null : trimmedNote;
    }
    onSave(body);
  }

  return (
    <Section title="Edit">
      <form noValidate onSubmit={onFormSubmit} className="grid gap-4">
        <Field
          label="Due date"
          error={submitted && dueMissing ? "Pick a due date." : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Note" hint="Optional. Clear the box to remove the note.">
          {({ id, describedBy }) => (
            <textarea
              id={id}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={describedBy}
              className={textareaClass}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !dirty}
            aria-busy={saving || undefined}
            className={cn(primaryButton, "min-h-11 sm:min-w-28")}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Section>
  );
}

function RecordPaymentForm({
  remaining,
  saving,
  onCancel,
  onSubmit,
}: {
  remaining: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (body: RecordPaymentBody) => void;
}) {
  const [amount, setAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(() =>
    localDateTimeValue(new Date()),
  );
  const [reference, setReference] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const amountError = validateAmount(amount, remaining);
  const receivedIso = localDateTimeToIso(receivedAt);
  const receivedError =
    receivedIso === undefined ? "Pick a date and time." : undefined;

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (amountError || receivedError || receivedIso === undefined) return;
    const txnReference = reference.trim();
    onSubmit({
      amount: parseAmount(amount),
      receivedAt: receivedIso,
      ...(txnReference ? { txnReference } : {}),
    });
  }

  return (
    <form noValidate onSubmit={onFormSubmit} className="grid gap-5">
      <Field
        label="Amount (৳)"
        hint={`${formatAmount(remaining)} still due`}
        error={submitted ? amountError : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(inputClass, "tabular-nums")}
          />
        )}
      </Field>
      <Field label="Received on" error={submitted ? receivedError : undefined}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={inputClass}
          />
        )}
      </Field>
      <Field label="Reference (optional)">
        {({ id, describedBy }) => (
          <input
            id={id}
            type="text"
            autoComplete="off"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            aria-describedby={describedBy}
            className={inputClass}
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
          {saving ? "Saving..." : "Record payment"}
        </button>
      </DialogActions>
    </form>
  );
}

function ReversePaymentForm({
  reversible,
  saving,
  onCancel,
  onSubmit,
}: {
  reversible: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (body: ReversePaymentBody) => void;
}) {
  const [amount, setAmount] = useState(() => String(Number(reversible)));
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const amountError =
    validateAmount(amount) ??
    (parseAmount(amount) > Number(reversible)
      ? `More than the ${formatAmount(reversible)} that can be reversed.`
      : undefined);
  const reasonError = validateReason(reason);

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (amountError || reasonError) return;
    onSubmit({ amount: parseAmount(amount), reason: reason.trim() });
  }

  return (
    <form noValidate onSubmit={onFormSubmit} className="grid gap-5">
      <Field
        label="Amount"
        hint={`Up to ${formatAmount(reversible)} can be reversed.`}
        error={submitted ? amountError : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(inputClass, "tabular-nums")}
          />
        )}
      </Field>
      <Field
        label="Reason"
        hint={`${REASON_MIN} to ${REASON_MAX} characters.`}
        error={submitted ? reasonError : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
            secondaryButton,
            "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-36",
          )}
        >
          {saving ? "Saving..." : "Reverse payment"}
        </button>
      </DialogActions>
    </form>
  );
}

function ConfirmActions({
  label,
  destructive = false,
  pending,
  onCancel,
  onConfirm,
}: {
  label: string;
  destructive?: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogActions>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        aria-busy={pending || undefined}
        className={cn(
          destructive
            ? cn(secondaryButton, "text-[var(--color-semantic-error-text)]")
            : primaryButton,
          "min-h-11 sm:min-w-28",
        )}
      >
        {pending ? "Saving..." : label}
      </button>
    </DialogActions>
  );
}
