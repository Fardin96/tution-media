"use client";

import {
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  card,
  focusRing,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import {
  AdminDialog,
  DetailList,
  DialogActions,
  Field,
  Section,
  StatusPill,
  textareaClass,
} from "@/components/admin/admin-ui";
import { formatDateTime, useAdminMe } from "@/lib/admin";
import {
  ACCOUNT_STATUS_LABEL,
  CASE_NOTE_MAX,
  CASE_STATUS_META,
  ROLE_LABEL,
  isCaseOpen,
  partyName,
  validateCaseNote,
  type AdminParty,
  type CaseActionVariables,
  type CaseStatus,
} from "@/lib/admin-cases";
import { errorCodeMessage } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";

/** The server's message for a 409, the catalogue copy for a known code, a short server message, or the fallback. */
export function failureText(err: unknown, fallback: string): string {
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

export function isConflict(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409;
}

/** Read-only star display. The count is in the label, so the glyphs are hidden from screen readers. */
/** "Mina → Rafi" that reads as "Mina about Rafi" to a screen reader. */
export function Parties({
  from,
  to,
  word,
}: {
  from: string;
  to: string;
  word: string;
}) {
  return (
    <span className="break-words">
      {from}
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> {word} </span>
      {to}
    </span>
  );
}

export function CaseStatusPill({ status }: { status: CaseStatus }) {
  const meta = CASE_STATUS_META[status];
  return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>;
}

/** Who is on one side of a case: name, role, contact and account state, with a link to the account page. */
export function PartySection({
  title,
  party,
}: {
  title: string;
  party: AdminParty;
}) {
  return (
    <Section
      title={title}
      actions={
        <Link
          href={`/dashboard/admin/accounts/${encodeURIComponent(party.accountId)}`}
          className={cn(ghostButton, "min-h-10")}
        >
          <LinkPendingLabel>Open account</LinkPendingLabel>
        </Link>
      }
    >
      <DetailList
        items={[
          { label: "Name", value: partyName(party) },
          { label: "Role", value: ROLE_LABEL[party.role] },
          {
            label: "Email",
            value: <span className="break-all">{party.email}</span>,
          },
          {
            label: "Account",
            value: (
              <StatusPill
                tone={party.status === "ACTIVE" ? "success" : "error"}
              >
                {ACCOUNT_STATUS_LABEL[party.status]}
              </StatusPill>
            ),
          },
        ]}
      />
    </Section>
  );
}

/** The report or dispute text as the person wrote it. Line breaks stay. */
export function DetailsSection({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <Section title={title}>
      <p className="text-sm break-words whitespace-pre-line text-[var(--color-neutral-charcoal)]">
        {text}
      </p>
    </Section>
  );
}

/** What was decided, by whom, and when. Shown on closed cases. */
export function OutcomeSection({
  status,
  note,
  handledBy,
  resolvedAt,
}: {
  status: CaseStatus;
  note: string | null;
  handledBy: { name: string | null } | null;
  resolvedAt: string | null;
}) {
  return (
    <Section title={status === "DISMISSED" ? "Dismissed" : "Resolved"}>
      <DetailList
        items={[
          { label: "Note", value: note },
          { label: "Handled by", value: handledBy?.name ?? "An admin" },
          { label: "Closed", value: formatDateTime(resolvedAt) },
        ]}
      />
    </Section>
  );
}

type Dialog = "RESOLVE" | "DISMISS";

/**
 * Take, Resolve and Dismiss for one case. Renders nothing once the case is closed.
 * Drop it into AdminPage's `actions`; its dialogs are portals.
 */
export function CaseActions({
  noun,
  status,
  handledBy,
  mutation,
}: {
  noun: "report" | "dispute";
  status: CaseStatus;
  handledBy: { accountId: string } | null;
  mutation: UseMutationResult<unknown, ApiError, CaseActionVariables>;
}) {
  const admin = useAdminMe();
  const [dialog, setDialog] = useState<Dialog | null>(null);

  if (!isCaseOpen(status)) return null;

  const mine =
    handledBy !== null &&
    admin.adminUser !== null &&
    handledBy.accountId === admin.adminUser.accountId;
  const busy = mutation.isPending;
  const taking = busy && mutation.variables?.action === "ASSIGN";

  function take() {
    mutation.mutate(
      { action: "ASSIGN" },
      {
        onSuccess: () => toast.success(`You took this ${noun}.`),
        onError: (err) =>
          toast.error(failureText(err, `Couldn't take this ${noun}.`)),
      },
    );
  }

  function submit(action: "RESOLVE" | "DISMISS", note: string) {
    mutation.mutate(
      { action, note },
      {
        onSuccess: () => {
          toast.success(
            `${noun === "report" ? "Report" : "Dispute"} ${action === "RESOLVE" ? "resolved" : "dismissed"}.`,
          );
          setDialog(null);
        },
        onError: (err) => {
          toast.error(
            failureText(
              err,
              `Couldn't ${action === "RESOLVE" ? "resolve" : "dismiss"} this ${noun}.`,
            ),
          );
          if (isConflict(err)) setDialog(null);
        },
      },
    );
  }

  function closeDialog() {
    if (!busy) setDialog(null);
  }

  return (
    <>
      {!mine && (
        <button
          type="button"
          onClick={take}
          disabled={busy}
          aria-busy={taking || undefined}
          className={cn(secondaryButton, "min-h-11")}
        >
          <PendingLabel pending={taking}>Take this case</PendingLabel>
        </button>
      )}
      <button
        type="button"
        onClick={() => setDialog("RESOLVE")}
        disabled={busy}
        className={cn(primaryButton, "min-h-11")}
      >
        Resolve
      </button>
      <button
        type="button"
        onClick={() => setDialog("DISMISS")}
        disabled={busy}
        className={cn(secondaryButton, "min-h-11")}
      >
        Dismiss
      </button>

      <AdminDialog
        open={dialog === "RESOLVE"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        busy={busy}
        title={`Resolve this ${noun}?`}
        description="Say what you did. The person who filed it sees this note."
      >
        <NoteForm
          label="Note"
          submitLabel={`Resolve ${noun}`}
          saving={busy}
          onCancel={closeDialog}
          onSubmit={(note) => submit("RESOLVE", note)}
        />
      </AdminDialog>

      <AdminDialog
        open={dialog === "DISMISS"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        busy={busy}
        title={`Dismiss this ${noun}?`}
        description="Use this when there is nothing to act on. Say why. The person who filed it sees this note."
      >
        <NoteForm
          label="Note"
          submitLabel={`Dismiss ${noun}`}
          saving={busy}
          onCancel={closeDialog}
          onSubmit={(note) => submit("DISMISS", note)}
        />
      </AdminDialog>
    </>
  );
}

/** One required note (3 to 500 characters) and a submit. Submits the trimmed note. */
export function NoteForm({
  label,
  submitLabel,
  saving,
  onCancel,
  onSubmit,
  max = CASE_NOTE_MAX,
  validate = validateCaseNote,
}: {
  label: string;
  submitLabel: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
  max?: number;
  validate?: (text: string) => string | undefined;
}) {
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const noteError = validate(note);

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (noteError) return;
    onSubmit(note.trim());
  }

  return (
    <form noValidate onSubmit={onFormSubmit} className="grid gap-5">
      <Field
        label={label}
        hint={`${note.length}/${max}`}
        error={submitted ? noteError : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            rows={3}
            maxLength={max}
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
          <PendingLabel pending={saving}>{submitLabel}</PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}

/** A card-sized link row for the case lists. Intent prefetch handlers pass through. */
export function CaseLink({
  href,
  children,
  ...intent
}: {
  href: string;
  children: ReactNode;
} & Pick<ComponentProps<"a">, "onMouseEnter" | "onFocus" | "onTouchStart">) {
  return (
    <Link
      href={href}
      {...intent}
      className={cn(card, "grid gap-3 p-5", focusRing)}
    >
      {children}
    </Link>
  );
}
