import type * as React from "react";
import { cn } from "@/lib/utils";
import { STATUS_META, type ApplicationStatus } from "@/lib/applications";
import type { Tone } from "@/lib/requirements";

// Same colours as the Pill in components/profile/profile-dashboard.tsx.
const TONE: Record<Tone, string> = {
  success:
    "bg-[var(--color-semantic-success-surface)] text-[var(--color-semantic-success-text)]",
  warning:
    "bg-[var(--color-semantic-warning-surface)] text-[var(--color-semantic-warning-text)]",
  error:
    "bg-[var(--color-semantic-error-surface)] text-[var(--color-semantic-error-text)]",
  neutral:
    "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]",
  info: "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]",
};

export function TonePill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function StatusPill({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <TonePill tone={meta.tone} className={className}>
      {meta.label}
    </TonePill>
  );
}
