"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/components/profile/styles";
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
import { formatDateTime, useAdminMe } from "@/lib/admin";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  useAdminAccount,
  useBlockAccount,
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
  DELETED: { tone: "neutral", label: "Deleted" },
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
  const [dialog, setDialog] = useState<"block" | "unblock" | null>(null);

  const block = useBlockAccount(id);
  const unblock = useUnblockAccount(id);

  const isViewer = me.adminUser?.accountId === id;
  const canBlock =
    me.isSuperAdmin &&
    account !== undefined &&
    account.status === "ACTIVE" &&
    account.adminRole !== "SUPER_ADMIN" &&
    !isViewer &&
    !account.activeBlock;

  const actions =
    me.isSuperAdmin && account ? (
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
            <BlockForm
              busy={block.isPending}
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
                {unblock.isPending ? "Unblocking..." : "Unblock"}
              </button>
            </DialogActions>
          </AdminDialog>
        </>
      )}
    </AdminPage>
  );
}

function BlockForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
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
            secondaryButton,
            "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-28",
          )}
        >
          {busy ? "Blocking..." : "Block"}
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
    { label: "Deleted at", value: formatDateTime(account.deletedAt) },
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
