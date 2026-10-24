"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { profileApi } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { ghostButton, secondaryButton } from "@/components/profile/styles";

export function DeleteAccountButton({ className }: { className?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await profileApi.deleteMe();
      api.clearTokens();
      router.replace("/");
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof Error ? err.message : "Couldn't delete your account.",
      );
    }
  };

  if (confirming) {
    return (
      <div className={cn("grid gap-3", className)}>
        <p className="text-sm text-[var(--color-semantic-error-text)]">
          This permanently deletes your account and data. Are you sure?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
            className={cn(secondaryButton, "flex-1")}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className={cn(
              secondaryButton,
              "flex-1 bg-[var(--color-semantic-error-surface)] text-[var(--color-semantic-error-text)] shadow-none hover:bg-[color-mix(in_oklab,var(--color-semantic-error-surface),var(--color-semantic-error-text)_8%)]",
            )}
          >
            {busy ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-[var(--color-semantic-error-text)]"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={cn(
        ghostButton,
        "w-full text-[var(--color-semantic-error-text)] hover:bg-[var(--color-semantic-error-surface)] hover:text-[var(--color-semantic-error-text)]",
        className,
      )}
    >
      <Trash2 aria-hidden="true" className="size-4" />
      Delete account
    </button>
  );
}
