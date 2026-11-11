"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { profileApi } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { ghostButton, secondaryButton } from "@/components/profile/styles";

type Step = "idle" | "choose" | "confirm-soft" | "confirm-hard";

export function DeleteAccountButton({ className }: { className?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [busy, setBusy] = useState(false);

  const execute = async (mode: "soft" | "hard") => {
    setBusy(true);
    try {
      if (mode === "soft") {
        await profileApi.deleteMe();
      } else {
        await profileApi.hardDeleteMe();
      }
      api.clearTokens();
      router.replace("/");
    } catch (err) {
      setBusy(false);
      toast.error(
        err instanceof Error ? err.message : "Couldn't delete your account.",
      );
    }
  };

  if (step === "choose") {
    return (
      <div className={cn("grid gap-3", className)}>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Choose how you want to delete your account.
        </p>
        <div className="grid gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep("confirm-soft")}
            className={cn(secondaryButton, "w-full text-left")}
          >
            <span className="block">Soft delete</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep("confirm-hard")}
            className={cn(
              secondaryButton,
              "w-full border-[var(--color-semantic-error-text)]/30 text-left text-[var(--color-semantic-error-text)] hover:bg-[var(--color-semantic-error-surface)]",
            )}
          >
            <span className="block">Hard delete</span>
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setStep("idle")}
          className={cn(ghostButton, "w-full")}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (step === "confirm-soft") {
    return (
      <div className={cn("grid gap-3", className)}>
        <p className="text-sm text-[var(--color-neutral-charcoal)]">
          Soft delete will deactivate your account. Your data is kept and you
          can reactivate later.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep("choose")}
            className={cn(secondaryButton, "flex-1")}
          >
            Back
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => execute("soft")}
            className={cn(secondaryButton, "flex-1")}
          >
            {busy ? "Deleting…" : "Confirm soft delete"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "confirm-hard") {
    return (
      <div className={cn("grid gap-3", className)}>
        <p className="text-sm text-[var(--color-semantic-error-text)]">
          This permanently deletes your account and all data. Are you sure?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep("choose")}
            className={cn(secondaryButton, "flex-1")}
          >
            Back
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => execute("hard")}
            className={cn(
              secondaryButton,
              "flex-1 bg-[var(--color-semantic-error-surface)] text-[var(--color-semantic-error-text)] shadow-none hover:bg-[color-mix(in_oklab,var(--color-semantic-error-surface),var(--color-semantic-error-text)_8%)]",
            )}
          >
            {busy ? "Deleting…" : "Yes, hard delete"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setStep("choose")}
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
