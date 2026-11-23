"use client";

import { useState } from "react";
import type * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// keepMounted only: closing is quicker than opening.
const KEEP_OPEN = {
  height: { duration: 0.24, ease: EASE_OUT },
  opacity: { duration: 0.18, ease: EASE_OUT },
};
const KEEP_CLOSE = {
  height: { duration: 0.18, ease: EASE_OUT },
  opacity: { duration: 0.12, ease: EASE_OUT },
};
const KEEP_REDUCED = { height: { duration: 0 }, opacity: { duration: 0.12 } };

/**
 * Height-auto reveal for "Show more" panels and expandable rows (animate-ui's Collapsible content).
 * The content mounts only while `open`, like the `{open && ...}` it replaces. Overflow is clipped
 * only while it moves, so focus rings inside are not cut off once it settles.
 * keepMounted: the content mounts on first open and then stays mounted, collapsed and inert while
 * closed, so state inside it (a loaded map, say) survives a close.
 */
export function Expand({
  open,
  id,
  className,
  keepMounted = false,
  children,
}: {
  open: boolean;
  id?: string;
  className?: string;
  keepMounted?: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [everOpen, setEverOpen] = useState(open);
  if (keepMounted && open && !everOpen) setEverOpen(true);

  if (keepMounted) {
    if (!everOpen) return null;
    return (
      <motion.div
        id={id}
        className={className}
        inert={!open}
        aria-hidden={!open || undefined}
        initial={{ height: 0, opacity: 0, overflow: "hidden" }}
        animate={
          open
            ? {
                height: "auto",
                opacity: 1,
                transitionEnd: { overflow: "visible" },
                transition: reduce ? KEEP_REDUCED : KEEP_OPEN,
              }
            : {
                height: 0,
                opacity: 0,
                overflow: "hidden",
                transition: reduce ? KEEP_REDUCED : KEEP_CLOSE,
              }
        }
      >
        {children}
      </motion.div>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="expand"
          id={id}
          className={className}
          initial={{ height: 0, opacity: 0, overflow: "hidden" }}
          animate={{
            height: "auto",
            opacity: 1,
            transitionEnd: { overflow: "visible" },
          }}
          exit={{ height: 0, opacity: 0, overflow: "hidden" }}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  height: { duration: 0.24, ease: EASE_OUT },
                  opacity: { duration: 0.18, ease: EASE_OUT },
                }
          }
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
