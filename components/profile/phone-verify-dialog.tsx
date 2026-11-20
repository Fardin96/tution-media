"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { AdminDialog } from "@/components/admin/admin-ui";
import { parseNewPhone } from "@/lib/phone-verification";
import { formatBdPhone } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { control } from "./profile-fields";
import { PhoneVerificationPanel } from "./phone-verification-panel";
import { ghostButton, primaryButton, secondaryButton } from "./styles";

type VerifiedPhone = { phoneNumber: string; verifiedAt: string };

export interface PhoneVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The profile's number, E.164. */
  currentPhone: string;
  /** Opens on this number instead of the profile's (for example, the number a save was refused for). */
  initialNumber?: string | null;
  /** The profile now holds the verified number. */
  onVerified: (result: VerifiedPhone) => void;
}

/**
 * Verifies a number for the profile. Verifying a different number changes the profile's number
 * (the API does that), so the dialog closes once the code is accepted.
 */
export function PhoneVerifyDialog({
  open,
  onOpenChange,
  currentPhone,
  initialNumber = null,
  onVerified,
}: PhoneVerifyDialogProps) {
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Verify your phone number"
    >
      {open && (
        <PhoneVerifyBody
          currentPhone={currentPhone}
          initialNumber={initialNumber}
          onVerified={(result) => {
            onOpenChange(false);
            onVerified(result);
            toast.success("Phone number verified.");
          }}
        />
      )}
    </AdminDialog>
  );
}

function PhoneVerifyBody({
  currentPhone,
  initialNumber,
  onVerified,
}: {
  currentPhone: string;
  initialNumber: string | null;
  onVerified: (result: VerifiedPhone) => void;
}) {
  const id = useId();
  const inputId = `${id}-new-number`;
  const errorId = `${id}-new-number-error`;
  const [target, setTarget] = useState(initialNumber ?? currentPhone);
  const [entering, setEntering] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  if (entering) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      const result = parseNewPhone(draft);
      if ("error" in result) {
        setDraftError(result.error);
        return;
      }
      setDraftError(null);
      setTarget(result.phoneNumber);
      setEntering(false);
    };

    return (
      <form noValidate onSubmit={submit} className="grid gap-4">
        <div className="grid gap-2">
          <label
            htmlFor={inputId}
            className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
          >
            New mobile number
          </label>
          <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
            We&apos;ll text a code to this number. Once you confirm it, it
            becomes your profile number.
          </p>
          <input
            id={inputId}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setDraftError(null);
            }}
            aria-invalid={draftError ? true : undefined}
            aria-describedby={draftError ? errorId : undefined}
            className={cn(control, "h-12")}
          />
          {draftError && (
            <p
              id={errorId}
              role="alert"
              className="text-sm font-medium text-[var(--color-semantic-error-text)]"
            >
              {draftError}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setDraftError(null);
              setEntering(false);
            }}
            className={secondaryButton}
          >
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            Use this number
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-5">
      <PhoneVerificationPanel
        key={target}
        phoneNumber={target}
        verifiedAt={null}
        onVerified={onVerified}
      />
      <div className="border-t border-[var(--color-neutral-border)] pt-4">
        <button
          type="button"
          onClick={() => {
            setDraft(target === currentPhone ? "" : formatBdPhone(target));
            setEntering(true);
          }}
          className={cn(ghostButton, "min-h-10 px-3")}
        >
          Use a different number
        </button>
      </div>
    </div>
  );
}
