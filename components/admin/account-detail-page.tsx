"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  dangerButton,
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
  type PillTone,
} from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { PendingLabel } from "@/components/ui/pending-label";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDateTime, useAdminMe } from "@/lib/admin";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  useAdminAccount,
  useBlockAccount,
  useDeactivateAccount,
  useHardDeleteAccount,
  useUnblockAccount,
  validateBlockReason,
  type AccountRole,
  type AccountStatus,
  type AdminAccountDetail,
} from "@/lib/admin-accounts";
import { AccountUploadsSection } from "@/components/admin/account-uploads-section";

type Verification = NonNullable<AdminAccountDetail["verificationStatus"]>;
type AdminRole = NonNullable<AdminAccountDetail["adminRole"]>;
type AdminStatus = NonNullable<AdminAccountDetail["adminStatus"]>;

const ROLE_LABEL: Record<AccountRole, string> = {
  STUDENT: "Student",
  TUTOR: "Tutor",
  ADMIN: "Admin",
};

const STATUS_PILL: Record<AccountStatus, { tone: PillTone; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  BLOCKED: { tone: "error", label: "Blocked" },
  DELETED: { tone: "neutral", label: "Deactivated" },
};

const VERIFICATION_LABEL: Record<Verification, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};

const ADMIN_STATUS_LABEL: Record<AdminStatus, string> = {
  PENDING: "Waiting for approval",
  ACTIVE: "Active",
  REMOVED: "Removed",
};

/** The name shown in dialogs and history: a person's name, then their email. */
function displayName(account: AdminAccountDetail): string {
  return account.name ?? account.email;
}

function byName(name: string | null): string {
  return name ?? "an admin";
}

export function AccountDetailPage({ id }: { id: string }) {
  const me = useAdminMe();
  const query = useAdminAccount(id);
  const account = query.data;
  const router = useRouter();
  const [dialog, setDialog] = useState<
    "block" | "unblock" | "deactivate" | "delete" | null
  >(null);

  const block = useBlockAccount(id);
  const unblock = useUnblockAccount(id);
  const deactivate = useDeactivateAccount(id);
  const hardDelete = useHardDeleteAccount(id);

  const isViewer = me.adminUser?.accountId === id;
  // Any active admin may act on students and tutors; admin accounts are for super admins only.
  // Nobody acts on their own account or on a super admin's.
  const canAct =
    me.isActive &&
    account !== undefined &&
    account.adminRole !== "SUPER_ADMIN" &&
    !isViewer &&
    (account.role !== "ADMIN" || me.isSuperAdmin);
  const canBlock =
    canAct && account.status === "ACTIVE" && !account.activeBlock;
  const canRemove = canAct;

  const actions =
    canAct && account ? (
      <>
        {canBlock && (
          <button
            type="button"
            onClick={() => setDialog("block")}
            className={cn(secondaryButton, "min-h-11")}
          >
            Block account
          </button>
        )}
        {account.activeBlock && (
          <button
            type="button"
            onClick={() => setDialog("unblock")}
            className={cn(primaryButton, "min-h-11")}
          >
            Unblock
          </button>
        )}
      </>
    ) : undefined;

  return (
    <AdminPage
      back={{ href: "/dashboard/admin/accounts", label: "Accounts" }}
      leading={
        account && (
          <UserAvatar
            src={account.avatarUrl}
            name={displayName(account)}
            size={56}
          />
        )
      }
      title={account ? displayName(account) : "Account"}
      actions={actions}
    >
      <QueryState
        query={query}
        isEmpty={false}
        loadingLabel="Loading account"
        errorText="Couldn't load this account."
        emptyText={null}
      >
        {account && (
          <>
            <Section title="Account">
              <DetailList items={accountItems(account)} />
            </Section>

            <Section title="Profile">
              <DetailList items={profileItems(account)} />
            </Section>

            <Section title="Activity">
              <DetailList
                items={[
                  { label: "Applications", value: account.counts.applications },
                  {
                    label: "Open requirements",
                    value: account.counts.openRequirements,
                  },
                  {
                    label: "Open packages",
                    value: account.counts.openPackages,
                  },
                ]}
              />
            </Section>

            <Section title="Blocks">
              {account.blocks.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Never blocked.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {account.blocks.map((block) => (
                    <li
                      key={block.id}
                      className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">
                          {`Blocked ${formatDateTime(block.blockedAt)}`}
                        </p>
                        {block.unblockedAt ? (
                          <StatusPill tone="neutral">Ended</StatusPill>
                        ) : (
                          <StatusPill tone="error">Active block</StatusPill>
                        )}
                      </div>
                      <p className="text-sm text-pretty break-words text-[var(--color-neutral-charcoal)]">
                        {block.reason}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                        {`Blocked by ${byName(block.blockedByName)}`}
                      </p>
                      {block.unblockedAt && (
                        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                          {`Unblocked by ${byName(block.unblockedByName)} ${formatDateTime(block.unblockedAt)}`}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {account.role !== "ADMIN" && (
              <AccountUploadsSection
                accountId={id}
                accountName={displayName(account)}
              />
            )}

            {canRemove && (
              <Section title="Close this account">
                <div className="grid gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                      {account.status === "DELETED"
                        ? "Deactivated. They can come back by signing up again."
                        : account.status === "BLOCKED"
                          ? "Unblock this account to deactivate it."
                          : "Deactivate signs them out, closes their open requirements and packages and withdraws pending applications. They can come back by signing up again."}
                    </p>
                    {account.status === "ACTIVE" && (
                      <button
                        type="button"
                        onClick={() => setDialog("deactivate")}
                        className={cn(secondaryButton, "min-h-11 shrink-0")}
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                      Delete permanently removes the account and everything in
                      it. You can&apos;t undo this.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDialog("delete")}
                      className={cn(dangerButton, "min-h-11 shrink-0")}
                    >
                      Delete permanently
                    </button>
                  </div>
                </div>
              </Section>
            )}
          </>
        )}
      </QueryState>

      {account && (
        <>
          <AdminDialog
            open={dialog === "block"}
            onOpenChange={(open) => setDialog(open ? "block" : null)}
            title={`Block ${displayName(account)}?`}
            description="They are signed out everywhere and can't sign in until unblocked."
            busy={block.isPending}
          >
            <ReasonForm
              busy={block.isPending}
              submitLabel="Block"
              onCancel={() => setDialog(null)}
              onSubmit={(reason) =>
                block.mutate(reason, {
                  onSuccess: () => {
                    toastSuccess("Account blocked");
                    setDialog(null);
                  },
                  onError: (err) =>
                    toastError("Couldn't block this account.", err),
                })
              }
            />
          </AdminDialog>

          <AdminDialog
            open={dialog === "unblock"}
            onOpenChange={(open) => setDialog(open ? "unblock" : null)}
            title={`Unblock ${displayName(account)}?`}
            description="They can sign in again right away."
            busy={unblock.isPending}
          >
            <DialogActions>
              <button
                type="button"
                autoFocus
                disabled={unblock.isPending}
                onClick={() => setDialog(null)}
                className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unblock.isPending}
                aria-busy={unblock.isPending || undefined}
                onClick={() =>
                  unblock.mutate(undefined, {
                    onSuccess: () => {
                      toastSuccess("Account unblocked");
                      setDialog(null);
                    },
                    onError: (err) =>
                      toastError("Couldn't unblock this account.", err),
                  })
                }
                className={cn(primaryButton, "min-h-11 sm:min-w-28")}
              >
                <PendingLabel pending={unblock.isPending}>Unblock</PendingLabel>
              </button>
            </DialogActions>
          </AdminDialog>

          <AdminDialog
            open={dialog === "deactivate"}
            onOpenChange={(open) => setDialog(open ? "deactivate" : null)}
            title={`Deactivate ${displayName(account)}?`}
            description="They are signed out everywhere. Their open requirements and packages close, pending applications are withdrawn and their stories leave the home page. They can come back by signing up again."
            busy={deactivate.isPending}
          >
            <ReasonForm
              busy={deactivate.isPending}
              submitLabel="Deactivate"
              onCancel={() => setDialog(null)}
              onSubmit={(reason) =>
                deactivate.mutate(reason, {
                  onSuccess: () => {
                    toastSuccess("Account deactivated");
                    setDialog(null);
                  },
                  onError: (err) =>
                    toastError("Couldn't deactivate this account.", err),
                })
              }
            />
          </AdminDialog>

          <AdminDialog
            open={dialog === "delete"}
            onOpenChange={(open) => setDialog(open ? "delete" : null)}
            title={`Delete ${displayName(account)} permanently?`}
            description="This removes the account and everything in it: profile, posts, applications, reviews, reports and uploaded files. You can't undo this. Accounts with payment records can't be deleted: block or deactivate them instead."
            busy={hardDelete.isPending}
          >
            <ReasonForm
              busy={hardDelete.isPending}
              submitLabel="Delete permanently"
              danger
              onCancel={() => setDialog(null)}
              onSubmit={(reason) =>
                hardDelete.mutate(reason, {
                  onSuccess: () => {
                    toastSuccess("Account deleted");
                    router.replace("/dashboard/admin/accounts");
                  },
                  onError: (err) =>
                    toastError("Couldn't delete this account.", err),
                })
              }
            />
          </AdminDialog>
        </>
      )}
    </AdminPage>
  );
}

/** A required reason for the audit log, then Cancel and the action (block, deactivate, delete). */
function ReasonForm({
  busy,
  submitLabel,
  danger = false,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  submitLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const error = submitted ? validateBlockReason(reason) : undefined;

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (validateBlockReason(reason)) return;
    onSubmit(reason.trim());
  }

  return (
    <form noValidate onSubmit={onFormSubmit}>
      <Field
        label="Reason"
        hint="The account owner does not see this."
        error={error}
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            autoFocus
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
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
          disabled={busy}
          className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy || undefined}
          className={cn(
            danger ? dangerButton : secondaryButton,
            "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-28",
          )}
        >
          <PendingLabel pending={busy}>{submitLabel}</PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}

function accountItems(account: AdminAccountDetail) {
  const consent = account.consentAcceptedAt
    ? `Accepted ${formatDateTime(account.consentAcceptedAt)}${
        account.consentVersion ? `, version ${account.consentVersion}` : ""
      }`
    : null;
  return [
    { label: "Email", value: account.email },
    { label: "Role", value: ROLE_LABEL[account.role] },
    {
      label: "Status",
      value: (
        <StatusPill tone={STATUS_PILL[account.status].tone}>
          {STATUS_PILL[account.status].label}
        </StatusPill>
      ),
    },
    { label: "Created", value: formatDateTime(account.createdAt) },
    { label: "Last sign-in", value: formatDateTime(account.lastLoginAt) },
    { label: "Deactivated at", value: formatDateTime(account.deletedAt) },
    { label: "Consent", value: consent },
  ];
}

function phoneValue(account: AdminAccountDetail): ReactNode {
  if (!account.phoneNumber) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {account.phoneNumber}
      {account.phoneVerifiedAt ? (
        <Badge variant="secondary">
          {`Verified ${formatDateTime(account.phoneVerifiedAt)}`}
        </Badge>
      ) : (
        <Badge variant="outline">Not verified</Badge>
      )}
    </span>
  );
}

function profileItems(account: AdminAccountDetail): {
  label: string;
  value: ReactNode;
}[] {
  return [
    { label: "Phone", value: phoneValue(account) },
    { label: "WhatsApp", value: account.whatsappNumber },
    ...(account.role === "TUTOR"
      ? [
          {
            label: "Verification",
            value: account.verificationStatus
              ? VERIFICATION_LABEL[account.verificationStatus]
              : null,
          },
          {
            label: "Listed in directory",
            value:
              account.isListed === null
                ? null
                : account.isListed
                  ? "Yes"
                  : "No",
          },
          { label: "Institute", value: account.instituteName },
        ]
      : []),
    ...(account.role === "ADMIN"
      ? [
          {
            label: "Admin role",
            value: account.adminRole
              ? ADMIN_ROLE_LABEL[account.adminRole]
              : null,
          },
          {
            label: "Admin status",
            value: account.adminStatus
              ? ADMIN_STATUS_LABEL[account.adminStatus]
              : null,
          },
        ]
      : []),
  ];
}
