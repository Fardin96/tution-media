"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { secondaryButton, focusRing } from "@/components/profile/styles";
import { cn } from "@/lib/utils";
import { popReturnTo, readReturnTo, type ReturnTo } from "@/lib/return-to";
import { stickyLift } from "@/lib/sticky-actions";

/**
 * The way back from a fix that left a form. It floats at the bottom of the screen, above any save
 * bar that is showing, and a spacer after the page keeps the last content clear of it. Reaching the
 * saved page pops that entry, so the next trip shows on later pages. The `motion-enter` fade and
 * rise are off under reduced motion.
 */
export function ReturnToBanner() {
  const pathname = usePathname();
  const [entry, setEntry] = useState<ReturnTo | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const [metrics, setMetrics] = useState({ lift: 0, height: 0 });

  useEffect(() => {
    let found = readReturnTo();
    while (found && found.path.split("?")[0] === pathname) {
      popReturnTo(found.path);
      found = readReturnTo();
    }
    setEntry(found);
  }, [pathname]);

  // Measured once per frame at most, on scroll, resize and DOM changes, as BackToTop does.
  useEffect(() => {
    if (!entry) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const lift = stickyLift(barRef.current);
      const height = barRef.current?.offsetHeight ?? 0;
      setMetrics((prev) =>
        prev.lift === lift && prev.height === height ? prev : { lift, height },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [entry]);

  if (!entry) return null;

  return (
    <>
      <aside
        ref={barRef}
        data-sticky-actions
        aria-label="Return to your form"
        // Lift moves with `translate`, like BackToTop, so the bar never jumps.
        style={{ translate: `0 -${metrics.lift}px` }}
        className="motion-enter fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-5xl rounded-[16px] bg-white/90 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.12)] backdrop-blur-md"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
          <p className="text-sm font-medium text-pretty text-[var(--color-neutral-charcoal)]">
            Fixed it?
          </p>
          <div className="flex items-center gap-1">
            <Link
              href={entry.path}
              className={cn(secondaryButton, "min-h-11 px-4", focusRing)}
            >
              <LinkPendingLabel>Back to your {entry.label}</LinkPendingLabel>
            </Link>
            <button
              type="button"
              aria-label={`Dismiss the way back to your ${entry.label}`}
              onClick={() => {
                popReturnTo(entry.path);
                setEntry(readReturnTo());
              }}
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-full text-[var(--color-primary-deep)] hover:bg-[color-mix(in_oklab,var(--color-primary-core)_10%,transparent)]",
                focusRing,
              )}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      </aside>
      {/* Keeps the last content clear of the floating bar, and of any bar it lifts above. */}
      <div
        aria-hidden="true"
        style={{
          height: `calc(${metrics.height + metrics.lift}px + 2rem + env(safe-area-inset-bottom))`,
        }}
      />
    </>
  );
}
