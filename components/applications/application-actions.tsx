"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/components/profile/styles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PendingLabel } from "@/components/ui/pending-label";
import {
  ACTION_META,
  useApplicationAction,
  type ApplicationAction,
} from "@/lib/applications";
import { ApiError } from "@/lib/profile";
import { toastError, toastSuccess } from "@/lib/toast";

// Forward moves get the primary style; stepping back or ending early stays secondary.
const PRIMARY_ACTIONS: ApplicationAction[] = ["confirm", "reopen", "complete"];

export function ApplicationActions({
  applicationId,
  allowedActions,
  className,
}: {
  applicationId: string;
  allowedActions: ApplicationAction[];
  className?: string;
}) {
  const [confirming, setConfirming] = useState<ApplicationAction | null>(null);
  const action = useApplicationAction();

  // The action that is running: its button shows the spinner, the rest are disabled.
  const pending = action.isPending ? action.variables?.action : undefined;

  if (allowedActions.length === 0) return null;

  // onDone runs only on success, so a confirm dialog stays open with its spinner until the
  // request lands, and stays open on error for the user to retry or cancel.
  function run(name: ApplicationAction, onDone?: () => void) {
    action.mutate(
      { id: applicationId, action: name },
      {
        onSuccess: () => {
          toastSuccess(ACTION_META[name].done);
          onDone?.();
        },
        onError: (err) => {
          // The confirm dialog is modal and would trap the toast's Verify button, so it closes first.
          if (
            err instanceof ApiError &&
            err.code === "PHONE_VERIFICATION_REQUIRED"
          ) {
            setConfirming(null);
          }
          toastError("Couldn't update this application. Try again.", err);
        },
      },
    );
  }

  function choose(name: ApplicationAction) {
    if (ACTION_META[name].confirm) {
      setConfirming(name);
    } else {
      run(name);
    }
  }

  const confirmMeta = confirming ? ACTION_META[confirming].confirm : null;
  const confirmPending = confirming !== null && pending === confirming;

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {allowedActions.map((name) => (
          <button
            key={name}
            type="button"
            disabled={action.isPending}
            aria-busy={pending === name || undefined}
            onClick={() => choose(name)}
            className={cn(
              PRIMARY_ACTIONS.includes(name) ? primaryButton : secondaryButton,
              "min-h-10 px-4",
            )}
          >
            <PendingLabel pending={pending === name}>
              {ACTION_META[name].label}
            </PendingLabel>
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={confirmMeta?.title ?? ""}
        actions={[
          {
            label: "Cancel",
            variant: "secondary",
            onSelect: () => setConfirming(null),
          },
          {
            label: confirmMeta?.confirmLabel ?? "Confirm",
            variant: "primary",
            pending: confirmPending,
            onSelect: () => {
              if (confirming) run(confirming, () => setConfirming(null));
            },
          },
        ]}
      >
        <p>{confirmMeta?.body ?? ""}</p>
      </ConfirmDialog>
    </>
  );
}
