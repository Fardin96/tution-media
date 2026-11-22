"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { profileApi } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { ghostButton } from "@/components/profile/styles";
import { BlockingOverlay } from "@/components/ui/blocking-overlay";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteAccountButton({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Stays busy after success: the overlay holds until the router leaves this page.
  const confirm = async () => {
    setBusy(true);
    try {
      await profileApi.hardDeleteMe();
      api.clearTokens();
      router.replace("/");
    } catch (err) {
      setBusy(false);
      toast.error(
        err instanceof Error ? err.message : "Couldn't delete your account.",
      );
    }
  };

  return (
    <>
      <BlockingOverlay open={busy} label="Deleting your account…" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          ghostButton,
          "w-full text-[var(--color-semantic-error-text)] hover:bg-[var(--color-semantic-error-surface)] hover:text-[var(--color-semantic-error-text)]",
          className,
        )}
      >
        <Trash2 aria-hidden="true" className="size-4" />
        Delete account
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        actions={[
          {
            label: "Cancel",
            variant: "secondary",
            onSelect: () => setOpen(false),
          },
          {
            label: "Delete account",
            variant: "danger",
            onSelect: () => void confirm(),
            pending: busy,
          },
        ]}
      >
        <p>
          This permanently deletes your account and everything in it: your
          profile, posts, applications and uploaded files.
        </p>
        <p>You can&apos;t undo this.</p>
      </ConfirmDialog>
    </>
  );
}
