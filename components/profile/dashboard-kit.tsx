"use client";

import type React from "react";
import { PauseCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { secondaryButton } from "./styles";

// Shared dashboard chrome: section headings, pills, empty states and the paused notice. Moved
// out of profile-dashboard.tsx so the stories section can use it without an import cycle.

export type Tone = "success" | "warning" | "error" | "neutral" | "info";

export const TONE: Record<Tone, string> = {
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

export function Pill({
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

export function SampleTag() {
  return (
    <span className="rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
      Sample data
    </span>
  );
}

export function SectionHeading({
  id,
  title,
  description,
  sample,
  action,
}: {
  id: string;
  title: string;
  description?: string;
  sample?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id={id}
            className="text-xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] sm:text-2xl"
          >
            {title}
          </h2>
          {sample && <SampleTag />}
        </div>
        {description && (
          <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(secondaryButton, "min-h-10")}
    >
      <Plus aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]">
        {icon}
      </span>
      <p className="mt-1 font-semibold text-[var(--color-neutral-charcoal)]">
        {title}
      </p>
      <p className="max-w-sm text-sm text-pretty text-[var(--color-text-secondary)]">
        {body}
      </p>
    </div>
  );
}

export const loadFailed = (
  <p className="px-6 py-10 text-center text-sm text-[var(--color-text-secondary)]">
    Couldn&apos;t load this list. Refresh the page to try again.
  </p>
);

export function PausedNotice({
  text,
  note,
}: {
  text: string;
  note: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] bg-[var(--color-semantic-warning-surface)] px-3 py-3 text-sm text-pretty text-[var(--color-semantic-warning-text)]">
      <PauseCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 break-words">
        <p className="font-semibold">{text}</p>
        {note && <p className="mt-1">Admin note: {note}</p>}
      </div>
    </div>
  );
}
