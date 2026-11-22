"use client";

import type * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Height-auto reveal for "Show more" panels and expandable rows (animate-ui's Collapsible content).
 * The content mounts only while `open`, like the `{open && ...}` it replaces. Overflow is clipped
 * only while it moves, so focus rings inside are not cut off once it settles.
 */
export function Expand({
  open,
  id,
  className,
  children,
}: {
  open: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
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
