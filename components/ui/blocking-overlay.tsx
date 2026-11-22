"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SpinnerEllipsis from "@/components/shadcn-space/spinner/spinner-05";

/**
 * Covers the page while a step that leaves it is running (signing in, paying, logging out).
 * While open, everything else is inert (no clicks, no keyboard focus, hidden from screen
 * readers) and the page can't scroll. If it closes without navigating (an error), focus goes
 * back where it was.
 *
 * The status region is mounted before it gets text, so screen readers announce the label.
 */
export function BlockingOverlay({
  open,
  label,
}: {
  open: boolean;
  label: string;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);

  useEffect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const others = Array.from(document.body.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        !el.hasAttribute("data-blocking-overlay") &&
        !el.inert,
    );
    for (const el of others) el.inert = true;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    document.body.setAttribute("aria-busy", "true");
    return () => {
      for (const el of others) el.inert = false;
      root.style.overflow = overflow;
      document.body.removeAttribute("aria-busy");
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);

  if (!host) return null;
  return createPortal(
    <div data-blocking-overlay="" role="status" aria-live="polite">
      {open && (
        <div className="animate-in fade-in fixed inset-0 z-[1000] grid place-items-center overscroll-contain bg-[color-mix(in_oklab,var(--color-neutral-white)_82%,transparent)] backdrop-blur-[2px] duration-200 ease-out motion-reduce:animate-none">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <SpinnerEllipsis className="text-[var(--color-primary-core)]" />
            <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
              {label}
            </p>
          </div>
        </div>
      )}
    </div>,
    host,
  );
}
