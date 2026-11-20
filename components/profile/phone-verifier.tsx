"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBdPhone } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { ghostButton, primaryButton } from "./styles";

const CODE_LENGTH = 6;

export interface PhoneVerifierProps {
  /** E.164, +8801... */
  phoneNumber: string;
  /** ISO timestamp. When set, the verified state is shown. */
  verifiedAt: string | null;
  /** Set after a successful send. */
  sent: { expiresAt: string; resendAfter: string } | null;
  sending: boolean;
  verifying: boolean;
  /** Already-friendly message. */
  error: string | null;
  /** A hint, not a failure (for example, a code was sent a moment ago). */
  notice?: string | null;
  onSend: () => void;
  onVerify: (code: string) => void;
  onChangeNumber?: () => void;
  autoFocus?: boolean;
}

/** Presentational: idle (send a code), sent (enter the code), verified. */
export function PhoneVerifier({
  phoneNumber,
  verifiedAt,
  sent,
  sending,
  verifying,
  error,
  notice,
  onSend,
  onVerify,
  onChangeNumber,
  autoFocus,
}: PhoneVerifierProps) {
  const id = useId();
  const inputId = `${id}-code`;
  const hintId = `${id}-hint`;
  const noticeId = `${id}-notice`;
  const errorId = `${id}-error`;
  const number = formatBdPhone(phoneNumber);

  const [code, setCode] = useState("");
  const [prevError, setPrevError] = useState(error);
  const [prevVerifying, setPrevVerifying] = useState(verifying);
  // A rejected code is cleared so it can be typed again. The typed code stays while a check runs.
  if (error !== prevError || verifying !== prevVerifying) {
    setPrevError(error);
    setPrevVerifying(verifying);
    if (error && (error !== prevError || !verifying)) setCode("");
  }

  // Set on submit, before the parent's pending state arrives, so a second
  // submit in the same tick is dropped. Released once the check settles.
  const submitting = useRef(false);
  useEffect(() => {
    if (!verifying) submitting.current = false;
  }, [verifying, error]);

  const expiresMs = sent ? Date.parse(sent.expiresAt) : null;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (expiresMs === null || now >= expiresMs) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, expiresMs - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [expiresMs, now]);
  const expired = expiresMs !== null && now >= expiresMs;

  if (verifiedAt) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <CircleCheck
          aria-hidden="true"
          className="size-5 shrink-0 text-[var(--color-semantic-success-text)]"
        />
        <p className="text-base font-medium text-[var(--color-neutral-charcoal)]">
          Verified
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
          {number}
        </p>
      </div>
    );
  }

  const errorNode = (message: string | null) =>
    message && (
      <p
        id={errorId}
        role="alert"
        className="text-sm text-pretty text-[var(--color-semantic-error-text)]"
      >
        {message}
      </p>
    );

  if (!sent) {
    return (
      <div className="flex flex-col gap-4">
        <p
          id={hintId}
          className="text-sm text-pretty text-[var(--color-text-secondary)]"
        >
          We’ll text a 6-digit code to {number}.
        </p>
        <Button
          type="button"
          onClick={onSend}
          disabled={sending}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          className={cn(primaryButton, "self-start active:translate-y-0")}
        >
          {sending && (
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          )}
          {sending ? "Sending…" : "Send code"}
        </Button>
        {errorNode(error)}
      </div>
    );
  }

  // An expired code has nothing useful to say about an earlier wrong attempt, so the expiry replaces the error.
  const shownError = expired ? null : error;

  const onCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(next);
    if (next.length === CODE_LENGTH && !verifying && !submitting.current) {
      submitting.current = true;
      onVerify(next);
    }
  };

  const describedBy = [hintId, notice && noticeId, shownError && errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>Verification code</Label>
        <p
          id={hintId}
          className="text-sm text-pretty text-[var(--color-text-secondary)]"
        >
          Enter the code we sent to {number}.
        </p>
        {notice && (
          <p
            id={noticeId}
            className="text-sm text-pretty text-[var(--color-text-secondary)]"
          >
            {notice}
          </p>
        )}
        <Input
          id={inputId}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          value={code}
          onChange={onCodeChange}
          readOnly={verifying}
          disabled={expired}
          aria-busy={verifying || undefined}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy}
          autoFocus={autoFocus}
          className={cn(
            "h-12 max-w-56 rounded-[12px] border-[var(--color-border-control)] bg-[var(--color-neutral-white)] px-4 text-start text-xl tracking-[0.4em] text-[var(--color-neutral-charcoal)] tabular-nums transition-[border-color,box-shadow] duration-150 ease-out hover:border-[var(--color-neutral-charcoal)] focus-visible:border-[var(--color-primary-core)] focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-core)_16%,transparent)] focus-visible:ring-0 focus-visible:outline-none disabled:opacity-60 aria-invalid:border-[var(--color-semantic-error-text)] aria-invalid:ring-0 motion-reduce:transition-none md:text-xl",
          )}
        />
        {verifying && (
          <p
            role="status"
            className="text-sm text-[var(--color-text-secondary)]"
          >
            Checking the code…
          </p>
        )}
        {expired && (
          <p
            role="status"
            className="text-sm text-pretty text-[var(--color-semantic-error-text)]"
          >
            This code has expired. Send a new one.
          </p>
        )}
        {errorNode(shownError)}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ResendControl
          key={sent.resendAfter}
          resendAfter={sent.resendAfter}
          sending={sending}
          onSend={onSend}
        />
        {onChangeNumber && (
          <Button
            type="button"
            variant="ghost"
            onClick={onChangeNumber}
            className={cn(ghostButton, "ms-auto")}
          >
            Change number
          </Button>
        )}
      </div>
    </div>
  );
}

const RESEND_READY = "You can request a new code now.";

// The resend cooldown always ends before the code expires, so an expired code is never held back by it.
function ResendControl({
  resendAfter,
  sending,
  onSend,
}: {
  resendAfter: string;
  sending: boolean;
  onSend: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(resendAfter) - now) / 1000),
  );
  const counting = remaining > 0;

  useEffect(() => {
    if (!counting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [counting]);

  // Only the end of the cooldown is announced. The per-second countdown stays silent.
  const wasCounting = useRef(counting);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (wasCounting.current && !counting) setReady(true);
    wasCounting.current = counting;
  }, [counting]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={onSend}
        disabled={sending || counting}
        className={ghostButton}
      >
        {sending && (
          <Loader2
            aria-hidden="true"
            className="size-4 animate-spin motion-reduce:animate-none"
          />
        )}
        Resend code
      </Button>
      <span
        aria-hidden="true"
        className="text-sm text-[var(--color-text-secondary)] tabular-nums"
      >
        {counting ? `Resend in ${formatCountdown(remaining)}` : ""}
      </span>
      <span aria-live="polite" className="sr-only">
        {ready ? RESEND_READY : ""}
      </span>
    </>
  );
}

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
