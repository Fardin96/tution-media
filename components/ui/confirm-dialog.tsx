"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@/components/animate-ui/primitives/radix/alert-dialog";
import { PendingLabel } from "@/components/ui/pending-label";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import {
  dangerButton,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";

export interface ConfirmAction {
  label: string;
  onSelect: () => void;
  /** `danger` is for an action that can't be undone, such as deleting the account. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  href?: string;
  /** Shows Spinner 05 in place of the label and disables every action while true. */
  pending?: boolean;
}

const variantClass = {
  primary: primaryButton,
  secondary: secondaryButton,
  ghost: ghostButton,
  danger: dangerButton,
} as const;

export function ConfirmDialog({
  open,
  title,
  children,
  actions,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  actions: ConfirmAction[];
  onOpenChange: (open: boolean) => void;
}) {
  const firstRef = React.useRef<HTMLElement | null>(null);
  const setFirst = (el: HTMLElement | null) => {
    firstRef.current = el;
  };

  return (
    <AlertDialog
      open={open}
      // A running action keeps the dialog open: Escape waits for it. Outside clicks never close an alert dialog.
      onOpenChange={(next) => {
        if (!next && actions.some((a) => a.pending)) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogPortal>
        <AlertDialogOverlay className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            firstRef.current?.focus();
          }}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-[24px] bg-[var(--color-neutral-white)] p-6 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.08)]",
            "focus:outline-none",
          )}
        >
          <AlertDialogTitle className="text-base font-semibold text-[var(--color-neutral-charcoal)]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="mt-2 grid gap-2 text-sm text-pretty text-[var(--color-text-secondary)]">
              {children}
            </div>
          </AlertDialogDescription>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {actions.map((action, i) => {
              const busy = actions.some((a) => a.pending);
              const className = variantClass[action.variant ?? "secondary"];
              const ref = i === 0 ? setFirst : undefined;
              return action.href ? (
                <Link
                  key={`${action.label}-${i}`}
                  ref={ref}
                  href={action.href}
                  onClick={action.onSelect}
                  className={className}
                >
                  <LinkPendingLabel>{action.label}</LinkPendingLabel>
                </Link>
              ) : (
                <button
                  key={`${action.label}-${i}`}
                  ref={ref}
                  type="button"
                  onClick={action.onSelect}
                  disabled={busy}
                  aria-busy={action.pending || undefined}
                  className={className}
                >
                  <PendingLabel pending={Boolean(action.pending)}>
                    {action.label}
                  </PendingLabel>
                </button>
              );
            })}
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
