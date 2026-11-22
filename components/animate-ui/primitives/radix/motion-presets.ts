import type { TargetAndTransition, Transition } from "motion/react";

// Shared by the animate-ui Dialog, AlertDialog and Popover ports, so every popup moves the same way.
// animate-ui's flip (tilt from the top, scale and blur in) with a shorter travel and a quicker exit.

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EXIT: Transition = { duration: 0.16, ease: EASE_OUT };

type Preset = {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
};

export const overlayMotion: Preset = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, transition: EXIT },
};

const FLIP_HIDDEN = "perspective(500px) rotateX(-14deg) scale(0.9)";

export function dialogMotion(reduce: boolean | null): Preset {
  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.15 } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    };
  }
  return {
    initial: { opacity: 0, filter: "blur(4px)", transform: FLIP_HIDDEN },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
      transform: "perspective(500px) rotateX(0deg) scale(1)",
      transition: { type: "spring", stiffness: 260, damping: 24 },
    },
    exit: {
      opacity: 0,
      filter: "blur(4px)",
      transform: FLIP_HIDDEN,
      transition: EXIT,
    },
  };
}

export function popoverMotion(reduce: boolean | null): Preset {
  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.15 } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.85, filter: "blur(4px)" },
    animate: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: { type: "spring", stiffness: 380, damping: 28 },
    },
    exit: { opacity: 0, scale: 0.9, filter: "blur(2px)", transition: EXIT },
  };
}
