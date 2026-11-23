"use client";

import { useState, useTransition } from "react";
import { api } from "@/lib/api";
import { client } from "@/lib/api-client";
import { signOut } from "@/lib/auth.server";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PendingLabel } from "@/components/ui/pending-label";
import { BlockingOverlay } from "@/components/ui/blocking-overlay";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export const logoutTriggerClass =
  "h-12 w-full gap-2 rounded-full border-[var(--color-neutral-border)] text-base font-semibold text-[var(--color-neutral-charcoal)] hover:bg-[var(--color-neutral-off-white)] active:scale-[0.96]";

export function LogoutButton({
  className,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  className?: string;
  // Controlled when the caller owns the dialog, e.g. the admin drawer closes before it opens.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // The caller renders its own trigger; this keeps the confirm dialog and overlay mounted.
  hideTrigger?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  // The whole logout runs inside the transition, so isPending covers revoke, clear and redirect.
  // The dialog stays open (its action shows the spinner) until signOut returns.
  const confirm = () => {
    if (isPending) return;
    startTransition(async () => {
      const tokens = api.getTokens();
      if (tokens?.refreshToken) {
        try {
          await client.POST("/api/v1/auth/logout", {
            body: { refreshToken: tokens.refreshToken },
          });
        } catch {
          // Best-effort revocation: still clear local state on failure.
        }
      }
      api.clearTokens();
      await signOut();
      setOpen(false);
    });
  };

  return (
    <>
      <BlockingOverlay open={isPending} label="Logging out…" />
      {!hideTrigger && (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          disabled={isPending}
          aria-busy={isPending || undefined}
          variant="outline"
          className={cn(logoutTriggerClass, className)}
        >
          <LogOut className="size-4" />
          <PendingLabel pending={isPending}>Log out</PendingLabel>
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Log out?"
        actions={[
          {
            label: "Cancel",
            variant: "secondary",
            onSelect: () => setOpen(false),
          },
          {
            label: "Log out",
            variant: "primary",
            onSelect: confirm,
            pending: isPending,
          },
        ]}
      >
        <p>You&apos;ll need to sign in again to see your dashboard.</p>
      </ConfirmDialog>
    </>
  );
}
