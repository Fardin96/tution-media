"use client";

import * as React from "react";
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from "input-otp";
import { cn } from "@/lib/utils";

/**
 * One real input (so labels, paste, `autocomplete="one-time-code"` and screen readers work as
 * usual) drawn as separate boxes, after animate-ui's InputOTP: each digit pops in and the active
 * box's ring and caret follow the typing. Digits only; a paste drops anything that isn't a digit.
 * The boxes share the row (at most 44px each), so six still fit a 320px screen inside a dialog.
 */
function InputOTP({
  className,
  containerClassName,
  ...props
}: Omit<
  React.ComponentProps<typeof OTPInput>,
  "pattern" | "pasteTransformer" | "render"
> & { children: React.ReactNode }) {
  return (
    <OTPInput
      data-slot="input-otp"
      pattern={REGEXP_ONLY_DIGITS}
      pasteTransformer={(pasted) =>
        pasted.replace(/\D/g, "").slice(0, props.maxLength)
      }
      inputMode="numeric"
      spellCheck={false}
      containerClassName={cn(
        "flex w-full max-w-[19rem] items-center has-disabled:opacity-60",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex w-full items-center gap-1.5 sm:gap-2", className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  invalid,
  className,
  ...props
}: React.ComponentProps<"div"> & { index: number; invalid?: boolean }) {
  const context = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = context?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive || undefined}
      className={cn(
        "relative flex h-11 min-w-0 flex-1 basis-0 items-center justify-center rounded-xl bg-[var(--color-neutral-white)] text-lg font-semibold text-[var(--color-neutral-charcoal)] tabular-nums",
        "shadow-[0_0_0_1px_rgb(0_0_0/0.12)] transition-[box-shadow,scale] duration-150 ease-out motion-reduce:transition-none",
        isActive &&
          "scale-[1.04] shadow-[0_0_0_2px_var(--color-primary-core)] motion-reduce:scale-100",
        invalid &&
          "shadow-[0_0_0_1px_var(--color-semantic-error-text)] data-active:shadow-[0_0_0_2px_var(--color-semantic-error-text)]",
        className,
      )}
      {...props}
    >
      {char && (
        <span key={char} className="motion-otp-char">
          {char}
        </span>
      )}
      {hasFakeCaret && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="motion-otp-caret h-5 w-px bg-[var(--color-neutral-charcoal)]" />
        </span>
      )}
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot };
