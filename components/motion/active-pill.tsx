"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The selected chip or tab's background, which slides to the new selection (animate-ui's Highlight).
 * Render it inside the selected item only; the item needs `relative isolate`. Each group passes its
 * own `layoutId` (from useId) so two groups on one page never trade pills.
 */
export function ActivePill({
  layoutId,
  className,
}: {
  layoutId: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden="true"
      className={cn("absolute inset-0 -z-10 rounded-full", className)}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", duration: 0.3, bounce: 0.1 }
      }
    />
  );
}
