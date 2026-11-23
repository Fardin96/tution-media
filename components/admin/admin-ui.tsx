"use client";

import * as React from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/animate-ui/primitives/radix/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  card,
  focusRing,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { control, FieldError } from "@/components/profile/profile-fields";
import { BackLink } from "@/components/ui/back-link";
import { PendingLabel } from "@/components/ui/pending-label";
import { Skeleton } from "@/components/ui/skeleton";

/* ───────── Page frame ───────── */

/** One admin page: the single BackLink, the title block, then the content. The shell supplies the chrome. */
export function AdminPage({
  back,
  leading,
  title,
  description,
  actions,
  children,
}: {
  back?: { href: string; label: string };
  /** Decorative lead-in before the title, such as a person's photo. */
  leading?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {back && (
        <div className="mb-4 flex">
          <BackLink href={back.href}>{back.label}</BackLink>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
          {leading}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1 max-w-prose text-sm text-pretty text-[var(--color-text-secondary)]">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </div>
  );
}

/* ───────── Status pills ───────── */

export type PillTone = "neutral" | "info" | "success" | "warning" | "error";

const PILL_TONE: Record<PillTone, string> = {
  neutral:
    "bg-[var(--color-neutral-off-white)] text-[var(--color-text-secondary)] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]",
  info: "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]",
  success:
    "bg-[var(--color-semantic-success-surface)] text-[var(--color-semantic-success-text)]",
  warning:
    "bg-[var(--color-semantic-warning-surface)] text-[var(--color-semantic-warning-text)]",
  error:
    "bg-[var(--color-semantic-error-surface)] text-[var(--color-semantic-error-text)]",
};

export function StatusPill({
  tone,
  children,
}: {
  tone: PillTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        PILL_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ───────── Filter chips (URL-driven filters) ───────── */

/** A row of mutually exclusive filters. Each is a toggle button; the row scrolls on narrow screens. */
export function FilterChips<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (value: V) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none",
              focusRing,
              active
                ? "bg-[var(--color-neutral-charcoal)] text-[var(--color-neutral-white)]"
                : "bg-[var(--color-neutral-white)] text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.1)] hover:bg-[var(--color-neutral-off-white)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────── Loading / error / empty ───────── */

/** Renders the loading skeleton, the error card with retry, the empty card, or the children. */
export function QueryState({
  query,
  isEmpty,
  loadingLabel,
  errorText,
  emptyText,
  skeletonCount = 3,
  children,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    isFetching?: boolean;
    refetch: () => unknown;
  };
  isEmpty: boolean;
  loadingLabel: string;
  errorText: string;
  emptyText: React.ReactNode;
  skeletonCount?: number;
  children: React.ReactNode;
}) {
  if (query.isPending) {
    return (
      <div role="status" className="grid gap-4">
        <span className="sr-only">{loadingLabel}</span>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(card, "flex flex-col gap-3 p-5 sm:p-6")}
          >
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div
        className={cn(card, "flex flex-col items-center gap-3 p-6 text-center")}
      >
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          {errorText}
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          aria-busy={query.isFetching || undefined}
          className={secondaryButton}
        >
          <PendingLabel pending={Boolean(query.isFetching)}>
            Try again
          </PendingLabel>
        </button>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div
        className={cn(
          card,
          "p-6 text-center text-sm text-pretty text-[var(--color-text-secondary)]",
        )}
      >
        {emptyText}
      </div>
    );
  }
  return <>{children}</>;
}

/** "Load more" for cursor-paginated (infinite) queries. */
export function LoadMore({
  query,
}: {
  query: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
  };
}) {
  if (!query.hasNextPage) return null;
  return (
    <div className="flex justify-center pt-2">
      <button
        type="button"
        onClick={() => void query.fetchNextPage()}
        disabled={query.isFetchingNextPage}
        aria-busy={query.isFetchingNextPage || undefined}
        className={secondaryButton}
      >
        <PendingLabel pending={query.isFetchingNextPage}>
          Load more
        </PendingLabel>
      </button>
    </div>
  );
}

/* ───────── Detail list ───────── */

/** Label/value pairs. Values that are null or "" render as an em dash so rows keep their rhythm. */
export function DetailList({
  items,
}: {
  items: { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium text-[var(--color-text-secondary)]">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-sm break-words text-[var(--color-neutral-charcoal)] tabular-nums">
            {item.value === null ||
            item.value === undefined ||
            item.value === ""
              ? "—"
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A titled card section on a detail page. */
export function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(card, "flex flex-col gap-4 p-5 sm:p-6")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--color-neutral-charcoal)]">
          {title}
        </h2>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/* ───────── Dialog ───────── */

/** Centered modal used for every admin decision form. Esc and the close button dismiss it unless `busy`. */
export function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  busy = false,
  onCloseAutoFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  busy?: boolean;
  /** Radix hook for where focus lands on close; call preventDefault to pick a different target. */
  onCloseAutoFocus?: React.ComponentProps<
    typeof DialogContent
  >["onCloseAutoFocus"];
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogContent
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            "fixed start-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto overscroll-contain rounded-[24px] bg-[var(--color-neutral-white)] p-6 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.08)] focus:outline-none rtl:translate-x-1/2",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-lg font-semibold text-balance text-[var(--color-neutral-charcoal)]">
              {title}
            </DialogTitle>
            <DialogClose
              disabled={busy}
              aria-label="Close"
              className={cn(ghostButton, "-me-3 -mt-2 min-h-10 px-3")}
            >
              <X aria-hidden="true" className="size-4" />
            </DialogClose>
          </div>
          {description ? (
            <DialogDescription className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
              {description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
          <div className="mt-5 min-w-0">{children}</div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

/** Cancel then the primary action; stacked on mobile with the primary on top. */
export function DialogActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}

/**
 * Primary button for a form or dialog request. While `pending` it is disabled, marked
 * aria-busy and shows Spinner 05 in place of its label (the label keeps its size and name).
 */
export function PendingButton({
  pending = false,
  disabled,
  type = "submit",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & {
  pending?: boolean;
  type?: "submit" | "button";
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(primaryButton, "min-h-11", className)}
    >
      <PendingLabel pending={pending}>{children}</PendingLabel>
    </button>
  );
}

/* ───────── Form fields ───────── */

type FieldProps = {
  label: string;
  /** Text, or a node such as a character counter. */
  hint?: React.ReactNode;
  error?: string;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
};

/** Label, control, hint and error wired together with ids. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className="grid min-w-0 gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
      >
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-xs text-[var(--color-text-secondary)]">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export const inputClass = cn(control, "min-h-11");
export const textareaClass = cn(control, "min-h-24 py-3");
