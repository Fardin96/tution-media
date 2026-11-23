"use client";

import { useRef, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/components/profile/styles";
import {
  AdminDialog,
  AdminPage,
  DialogActions,
  Field,
  inputClass,
  QueryState,
  Section,
  StatusPill,
  type PillTone,
} from "@/components/admin/admin-ui";
import { formatDateTime, useAdminMe } from "@/lib/admin";
import { errorCodeMessage, mapServerIssuesToFields } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";
import { PendingLabel } from "@/components/ui/pending-label";
import { enterClass, enterStyle } from "@/components/motion/enter";
import {
  useAdminInvites,
  useAdminTeam,
  useApproveAdmin,
  useInviteAdmin,
  useRemoveAdmin,
  useRevokeAdminInvite,
  type AdminInvite,
  type AdminTeamMember,
} from "@/lib/admin-team";

const STATUS_PILL: Record<
  AdminTeamMember["status"],
  { tone: PillTone; label: string }
> = {
  PENDING: { tone: "warning", label: "Pending" },
  ACTIVE: { tone: "success", label: "Active" },
  REMOVED: { tone: "neutral", label: "Removed" },
};

export function TeamPage() {
  const me = useAdminMe();
  const team = useAdminTeam();
  const approve = useApproveAdmin();
  const remove = useRemoveAdmin();
  const [removeTarget, setRemoveTarget] = useState<AdminTeamMember | null>(
    null,
  );
  const [removeOpen, setRemoveOpen] = useState(false);

  const admins = team.data ?? [];
  const groups = [
    {
      title: "Waiting for approval",
      members: admins.filter((admin) => admin.status === "PENDING"),
    },
    {
      title: "Active",
      members: admins.filter((admin) => admin.status === "ACTIVE"),
    },
    {
      title: "Removed",
      members: admins.filter((admin) => admin.status === "REMOVED"),
    },
  ].filter((group) => group.members.length > 0);

  const viewerId = me.adminUser?.accountId;

  // One approve mutation serves every row: the row being approved shows the spinner, the rest wait.
  function approvingThis(accountId: string) {
    return approve.isPending && approve.variables === accountId;
  }

  function openRemove(member: AdminTeamMember) {
    setRemoveTarget(member);
    setRemoveOpen(true);
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Admin team"
      description="New admins wait here until a super admin approves them. Invited admins skip this step."
    >
      <QueryState
        query={team}
        isEmpty={admins.length === 0}
        loadingLabel="Loading the admin team"
        errorText="Couldn't load the admin team."
        emptyText="No admins yet."
      >
        {groups.map((group) => (
          <Section key={group.title} title={group.title}>
            <ul className="grid gap-3">
              {group.members.map((member, index) => {
                const canApprove =
                  me.isSuperAdmin && member.status === "PENDING";
                const canRemove =
                  me.isSuperAdmin &&
                  member.status !== "REMOVED" &&
                  member.adminRole !== "SUPER_ADMIN" &&
                  member.accountId !== viewerId;
                return (
                  <li
                    key={member.accountId}
                    className={cn(
                      "flex flex-wrap items-start justify-between gap-3 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4",
                      enterClass,
                    )}
                    style={enterStyle(index)}
                  >
                    <div className="min-w-0 flex-1 basis-56">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
                          {member.name}
                        </p>
                        <StatusPill tone={STATUS_PILL[member.status].tone}>
                          {STATUS_PILL[member.status].label}
                        </StatusPill>
                        {member.adminRole === "SUPER_ADMIN" && (
                          <StatusPill tone="info">Super admin</StatusPill>
                        )}
                      </div>
                      <p className="mt-1 text-sm break-words text-[var(--color-text-secondary)]">
                        {member.email}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)] tabular-nums">
                        {`Joined ${formatDateTime(member.createdAt)}`}
                        {member.approvedAt &&
                          ` · Approved ${formatDateTime(member.approvedAt)}`}
                      </p>
                    </div>

                    {(canApprove || canRemove) && (
                      <div className="flex flex-wrap gap-2">
                        {canApprove && (
                          <button
                            type="button"
                            disabled={approve.isPending}
                            aria-busy={
                              approvingThis(member.accountId) || undefined
                            }
                            onClick={() =>
                              approve.mutate(member.accountId, {
                                onSuccess: () => toastSuccess("Admin approved"),
                                onError: (err) =>
                                  toastError(
                                    "Couldn't approve this admin.",
                                    err,
                                  ),
                              })
                            }
                            className={cn(primaryButton, "min-h-11")}
                          >
                            <PendingLabel
                              pending={approvingThis(member.accountId)}
                            >
                              Approve
                            </PendingLabel>
                          </button>
                        )}
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => openRemove(member)}
                            className={cn(secondaryButton, "min-h-11")}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        ))}
      </QueryState>

      {me.isSuperAdmin && <InvitesSection />}

      <AdminDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove ${removeTarget?.name ?? "this admin"}?`}
        description="They lose admin access right away and are signed out everywhere."
        busy={remove.isPending}
      >
        <DialogActions>
          <button
            type="button"
            autoFocus
            disabled={remove.isPending}
            onClick={() => setRemoveOpen(false)}
            className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={remove.isPending || !removeTarget}
            aria-busy={remove.isPending || undefined}
            onClick={() => {
              if (!removeTarget) return;
              remove.mutate(removeTarget.accountId, {
                onSuccess: () => {
                  toastSuccess("Admin removed");
                  setRemoveOpen(false);
                },
                onError: (err) =>
                  toastError("Couldn't remove this admin.", err),
              });
            }}
            className={cn(
              secondaryButton,
              "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-28",
            )}
          >
            <PendingLabel pending={remove.isPending}>Remove</PendingLabel>
          </button>
        </DialogActions>
      </AdminDialog>
    </AdminPage>
  );
}

const DAY_MS = 86_400_000;
// Mirrors the API's 14-day admin invite window (tuition-api, POST /admin/admins/invites).
const ADMIN_INVITE_DAYS = 14;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Only these conflicts are about the email itself. Other failures show as a toast.
const EMAIL_CONFLICT_CODES: readonly string[] = [
  "ACCOUNT_EXISTS",
  "SUPER_ADMIN_EMAIL",
  "INVITE_EXISTS",
];

function expiryText(invite: AdminInvite, now: number): string {
  const left = Date.parse(invite.expiresAt) - now;
  if (left < DAY_MS) return "Expires today";
  const days = Math.min(ADMIN_INVITE_DAYS, Math.ceil(left / DAY_MS));
  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
}

// The tutor-invite copy for INVITE_EXISTS does not fit an admin invite.
function inviteErrorText(err: ApiError): string | undefined {
  if (err.code === "INVITE_EXISTS") {
    return "This email already has an open invite.";
  }
  return errorCodeMessage(err);
}

async function copySignInLink(email: string) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/sign-in`);
    toastSuccess(`Link copied. Ask them to sign in with ${email}.`);
  } catch (err) {
    toastError("Couldn't copy the link.", err);
  }
}

/** Super admins only: the page renders this section for them alone. */
function InvitesSection() {
  const invites = useAdminInvites();
  const invite = useInviteAdmin();
  const renewal = useInviteAdmin();
  const revoke = useRevokeAdminInvite();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [revokeTarget, setRevokeTarget] = useState<AdminInvite | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [mountNow] = useState(() => Date.now());
  const emailRef = useRef<HTMLInputElement>(null);
  // Set when a revoke closes the dialog (success or 404), so focus returns to the email field.
  const revokedRef = useRef(false);

  const rows = invites.data ?? [];
  // Time of the last fetch, so expiry text matches the data on screen.
  const now = invites.dataUpdatedAt || mountNow;

  function renew(address: string) {
    renewal.mutate(address, {
      onSuccess: () =>
        toastSuccess(
          "Invite renewed. Copy the sign-in link and send it to them.",
        ),
      onError: (err) => {
        if (err instanceof ApiError && err.code === "INVITE_EXISTS") {
          // Passed without err: toastError would otherwise pick the tutor copy for this code.
          toastError("This email already has an open invite.");
          return;
        }
        toastError("Couldn't renew the invite.", err);
      },
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setEmailError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    invite.mutate(address, {
      onSuccess: () => {
        toastSuccess(
          "Invite added. Copy the sign-in link and send it to them.",
        );
        setEmail("");
      },
      onError: (err) => {
        const apiErr = err instanceof ApiError ? err : undefined;
        const issue = apiErr
          ? mapServerIssuesToFields<"email">(apiErr.issues).email
          : undefined;
        const message =
          issue ??
          (apiErr && EMAIL_CONFLICT_CODES.includes(apiErr.code ?? "")
            ? inviteErrorText(apiErr)
            : undefined);
        if (message) {
          setEmailError(message);
          emailRef.current?.focus();
        } else {
          toastError("Couldn't add the invite.", err);
        }
      },
    });
  }

  function onRevokeCloseAutoFocus(event: Event) {
    if (!revokedRef.current) return;
    revokedRef.current = false;
    event.preventDefault();
    emailRef.current?.focus();
  }

  return (
    <Section title="Invites">
      <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
        Invited people sign in with Google using that exact email and get admin
        access right away. No email is sent.
      </p>

      <form noValidate onSubmit={onSubmit} className="grid gap-3 sm:max-w-md">
        <Field label="Email" error={emailError}>
          {({ id, describedBy, invalid }) => (
            <input
              ref={emailRef}
              id={id}
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(undefined);
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={inputClass}
            />
          )}
        </Field>
        <div>
          <button
            type="submit"
            disabled={invite.isPending}
            aria-busy={invite.isPending || undefined}
            className={cn(primaryButton, "min-h-11")}
          >
            <PendingLabel pending={invite.isPending}>Add invite</PendingLabel>
          </button>
        </div>
      </form>

      {invites.isPending ? (
        <p role="status" className="text-sm text-[var(--color-text-secondary)]">
          Loading invites
        </p>
      ) : invites.isError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p className="text-[var(--color-text-secondary)]">
            {"Couldn't load invites."}
          </p>
          <button
            type="button"
            onClick={() => void invites.refetch()}
            disabled={invites.isFetching}
            aria-busy={invites.isFetching || undefined}
            className={cn(secondaryButton, "min-h-11")}
          >
            <PendingLabel pending={invites.isFetching}>Try again</PendingLabel>
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No open invites.
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row, index) => {
            const expired = row.expired || Date.parse(row.expiresAt) <= now;
            const renewing =
              renewal.isPending && renewal.variables === row.email;
            return (
              <li
                key={row.id}
                className={cn(
                  "flex flex-wrap items-start justify-between gap-3 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4",
                  enterClass,
                )}
                style={enterStyle(index)}
              >
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
                      {row.email}
                    </p>
                    {expired && <StatusPill tone="warning">Expired</StatusPill>}
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)] tabular-nums">
                    {`Invited by ${row.invitedByName} on ${formatDateTime(row.createdAt)}`}
                    {!expired && ` · ${expiryText(row, now)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {expired ? (
                    <button
                      type="button"
                      disabled={renewal.isPending}
                      aria-busy={renewing || undefined}
                      onClick={() => renew(row.email)}
                      className={cn(secondaryButton, "min-h-11")}
                    >
                      <PendingLabel pending={renewing}>
                        Invite again
                      </PendingLabel>{" "}
                      <span className="sr-only">for {row.email}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void copySignInLink(row.email)}
                      className={cn(secondaryButton, "min-h-11")}
                    >
                      Copy sign-in link{" "}
                      <span className="sr-only">for {row.email}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRevokeTarget(row);
                      setRevokeOpen(true);
                    }}
                    className={cn(
                      secondaryButton,
                      "min-h-11 text-[var(--color-semantic-error-text)]",
                    )}
                  >
                    Revoke <span className="sr-only">for {row.email}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AdminDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title={`Revoke the invite for ${revokeTarget?.email ?? "this email"}?`}
        description="They won't get admin access when they sign in."
        busy={revoke.isPending}
        onCloseAutoFocus={onRevokeCloseAutoFocus}
      >
        <DialogActions>
          <button
            type="button"
            autoFocus
            disabled={revoke.isPending}
            onClick={() => setRevokeOpen(false)}
            className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={revoke.isPending || !revokeTarget}
            aria-busy={revoke.isPending || undefined}
            onClick={() => {
              if (!revokeTarget) return;
              revoke.mutate(revokeTarget.id, {
                onSuccess: () => {
                  revokedRef.current = true;
                  toastSuccess("Invite revoked");
                  setRevokeOpen(false);
                },
                onError: (err) => {
                  // Already revoked or accepted elsewhere: the row is stale.
                  if (err instanceof ApiError && err.status === 404) {
                    revokedRef.current = true;
                    setRevokeOpen(false);
                    toastError("This invite was already used or revoked.");
                    return;
                  }
                  toastError("Couldn't revoke this invite.", err);
                },
              });
            }}
            className={cn(
              secondaryButton,
              "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-28",
            )}
          >
            <PendingLabel pending={revoke.isPending}>Revoke</PendingLabel>
          </button>
        </DialogActions>
      </AdminDialog>
    </Section>
  );
}
