import type { TargetAndTransition } from "motion/react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * One view giving way to another in place (a section's details swapping for its edit form). Use
 * inside `<AnimatePresence mode="popLayout" initial={false}>`, usually within AutoHeight.
 */
export function swapMotion(reduce: boolean | null): {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
} {
  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.15 } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    };
  }
  return {
    initial: { opacity: 0, y: 8, filter: "blur(4px)" },
    animate: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.28, ease: EASE_OUT, delay: 0.04 },
    },
    exit: {
      opacity: 0,
      filter: "blur(4px)",
      transition: { duration: 0.14, ease: EASE_OUT },
    },
  };
}

/**
 * A list item opening into place and closing out of it ("View more" / "Show less"). Use on a
 * motion element inside `<AnimatePresence initial={false}>`; `gap` replaces the list's own gap.
 */
export function revealMotion(
  reduce: boolean | null,
  gap: number,
): {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
} {
  if (reduce) {
    return {
      initial: { opacity: 0, marginTop: gap },
      animate: { opacity: 1, marginTop: gap, transition: { duration: 0.15 } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    };
  }
  return {
    initial: {
      opacity: 0,
      height: 0,
      marginTop: 0,
      y: -6,
      overflow: "hidden",
    },
    animate: {
      opacity: 1,
      height: "auto",
      marginTop: gap,
      y: 0,
      transitionEnd: { overflow: "visible" },
      transition: {
        height: { type: "spring", stiffness: 300, damping: 32 },
        marginTop: { type: "spring", stiffness: 300, damping: 32 },
        opacity: { duration: 0.24, ease: EASE_OUT, delay: 0.05 },
        y: { duration: 0.3, ease: EASE_OUT },
      },
    },
    exit: {
      opacity: 0,
      height: 0,
      marginTop: 0,
      y: -6,
      overflow: "hidden",
      transition: {
        height: { duration: 0.22, ease: EASE_OUT },
        marginTop: { duration: 0.22, ease: EASE_OUT },
        opacity: { duration: 0.12, ease: EASE_OUT },
        y: { duration: 0.22, ease: EASE_OUT },
      },
    },
  };
}
