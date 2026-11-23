"use client";

import { useEffect, useState } from "react";
import { ArrowGlyph } from "@/components/arrow-link-button";
import { focusRing } from "@/components/profile/styles";
import { cn } from "@/lib/utils";

// Bars that stick to the bottom of the screen while their form is in view.
const STICKY_ACTIONS = "[data-sticky-actions]";

// How far the button must rise to clear the sticky bars currently at the bottom of the screen.
function stickyLift() {
  let lift = 0;
  for (const bar of document.querySelectorAll<HTMLElement>(STICKY_ACTIONS)) {
    const rect = bar.getBoundingClientRect();
    if (
      rect.bottom >= window.innerHeight - 1 &&
      rect.top < window.innerHeight
    ) {
      lift = Math.max(lift, rect.height);
    }
  }
  return lift;
}

// display: none gives no client rects, so this finds the home link the reader can see.
function isRendered(el: Element) {
  return el.getClientRects().length > 0;
}

// Focus lands on the visible logo, then main, then the body, so it isn't lost at the top.
function focusHome() {
  const home = Array.from(
    document.querySelectorAll<HTMLElement>("[data-home-link]"),
  ).find(isRendered);
  if (home) {
    home.focus({ preventScroll: true });
    return;
  }
  const main = document.querySelector<HTMLElement>("main");
  if (main) {
    if (!main.hasAttribute("tabindex")) {
      main.tabIndex = -1;
      // Drop the temporary tabindex once focus leaves, so main isn't a tab stop later.
      main.addEventListener("blur", () => main.removeAttribute("tabindex"), {
        once: true,
      });
    }
    main.focus({ preventScroll: true });
    return;
  }
  (document.activeElement as HTMLElement | null)?.blur();
}

/**
 * Shows once the page scrolls past `threshold` viewport heights. The navbar isn't sticky, so this is the way back up.
 * Toasts sit above it (sonner's z-index is higher), so a toast covers it for a few seconds rather than being covered.
 */
export function BackToTop({ threshold = 1 }: { threshold?: number }) {
  const [shown, setShown] = useState(false);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const visible = window.scrollY > window.innerHeight * threshold;
      setShown(visible);
      setLift(visible ? stickyLift() : 0);
    };
    // Scroll fires many times a frame; measure at most once per frame.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Save bars mount when a form becomes dirty, with no scroll, so DOM changes need a re-measure too.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return (
    <button
      type="button"
      aria-label="Back to top"
      // Hidden: out of the tab order and the accessibility tree.
      inert={!shown}
      onClick={() => {
        // <html> has scroll-smooth with motion-reduce:scroll-auto, so this honours reduced motion.
        window.scrollTo({ top: 0 });
        focusHome();
      }}
      // Lift uses `translate`, not `bottom`: bottom isn't transitioned, so the button would jump.
      // Hidden keeps the old 0.5rem drop, measured from the same lifted spot so the fade starts there.
      style={{
        translate: shown ? `0 -${lift}px` : `0 calc(0.5rem - ${lift}px)`,
      }}
      className={cn(
        "fixed end-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 grid size-12 place-items-center rounded-full bg-[var(--color-primary-core)] text-[var(--color-neutral-white)] shadow-[0_4px_14px_0_color-mix(in_oklab,var(--color-primary-core)_40%,transparent)] transition-[background-color,opacity,translate,scale] duration-200 ease-out hover:bg-[var(--color-primary-hover)] active:scale-[0.96] active:bg-[var(--color-primary-pressed)] motion-reduce:transition-none sm:end-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
        focusRing,
      )}
    >
      <ArrowGlyph className="size-4 -rotate-45 bg-current" />
    </button>
  );
}
