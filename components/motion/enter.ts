import type { CSSProperties } from "react";

/** Class for a list row or card that fades and rises in when it mounts (see `.motion-enter` in app/globals.css). */
export const enterClass = "motion-enter";

// Past the sixth row the delay stops growing, so a long list never makes anyone wait.
const MAX_STAGGER = 6;

/**
 * Stagger for the row at `index`. The count restarts every `pageSize` rows, so rows added by
 * "Load more" cascade in from the top of their own page instead of waiting behind the earlier ones.
 */
export function enterStyle(index: number, pageSize = 20): CSSProperties {
  const step = Math.min(index % Math.max(pageSize, 1), MAX_STAGGER);
  return { "--enter-index": step } as CSSProperties;
}
