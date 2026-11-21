"use client";

import { useEffect, useState } from "react";
import { ArrowGlyph } from "@/components/arrow-link-button";
import { focusRing } from "@/components/profile/styles";
import { cn } from "@/lib/utils";

// Shows once the hero has scrolled away; the navbar isn't sticky, so this is the way back up.
export function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const update = () => setShown(window.scrollY > window.innerHeight);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      // Hidden: out of the tab order and the accessibility tree.
      inert={!shown}
      onClick={() => {
        // <html> has scroll-smooth with motion-reduce:scroll-auto, so this honours reduced motion.
        window.scrollTo({ top: 0 });
        // The button goes inert at the top; hand focus to the logo so it isn't lost.
        document
          .querySelector<HTMLElement>("header a")
          ?.focus({ preventScroll: true });
      }}
      className={cn(
        "fixed end-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 grid size-12 place-items-center rounded-full bg-[var(--color-primary-core)] text-[var(--color-neutral-white)] shadow-[0_4px_14px_0_color-mix(in_oklab,var(--color-primary-core)_40%,transparent)] transition-[background-color,opacity,translate,scale] duration-200 ease-out hover:bg-[var(--color-primary-hover)] active:scale-[0.96] active:bg-[var(--color-primary-pressed)] motion-reduce:transition-none sm:end-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]",
        shown ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        focusRing,
      )}
    >
      <ArrowGlyph className="size-4 -rotate-45 bg-current" />
    </button>
  );
}
