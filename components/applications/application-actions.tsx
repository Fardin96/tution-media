"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/components/profile/styles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import SpinnerEllipsis from "@/components/shadcn-space/spinner/spinner-05";
import {
  ACTION_META,
  useApplicationAction,
  type ApplicationAction,
} from "@/lib/applications";
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

  const pending = action.isPending ? action.variables?.action : undefined;

  if (allowedActions.length === 0) return null;

  function run(name: ApplicationAction) {
    action.mutate(
      { id: applicationId, action: name },
      {
        onSuccess: () => toastSuccess(ACTION_META[name].done),
        onError: (err) =>
          toastError("Couldn't update this application. Try again.", err),
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
            {ACTION_META[name].label}
            {pending === name && <SpinnerEllipsis />}
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
            onSelect: () => {
              if (confirming) run(confirming);
              setConfirming(null);
            },
          },
        ]}
      >
        <p>{confirmMeta?.body ?? ""}</p>
      </ConfirmDialog>
    </>
  );
}
