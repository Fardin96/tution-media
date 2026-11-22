"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/components/profile/styles";
import {
  AdminDialog,
  AdminPage,
  DialogActions,
  QueryState,
  Section,
  StatusPill,
  type PillTone,
} from "@/components/admin/admin-ui";
import { formatDateTime, useAdminMe } from "@/lib/admin";
import { toastError, toastSuccess } from "@/lib/toast";
import { PendingLabel } from "@/components/ui/pending-label";
import {
  useAdminTeam,
  useApproveAdmin,
  useRemoveAdmin,
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
      description="New admins wait here until a super admin approves them."
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
              {group.members.map((member) => {
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
                    className="flex flex-wrap items-start justify-between gap-3 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
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
