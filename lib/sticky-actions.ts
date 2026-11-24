// Bars that stick to the bottom of the screen while their form is in view. A bar may also float a
// little above the edge (the return-trip banner does), so the test allows some slack.
export const STICKY_ACTIONS = "[data-sticky-actions]";
const BOTTOM_SLACK = 40;

/**
 * How far an element anchored to the bottom of the screen must rise to sit just above the sticky
 * bars there: the distance from the screen's bottom to the highest such bar's top. `self` is skipped,
 * so a bar can measure the others.
 */
export function stickyLift(self?: Element | null): number {
  let lift = 0;
  for (const bar of document.querySelectorAll<HTMLElement>(STICKY_ACTIONS)) {
    if (bar === self) continue;
    const rect = bar.getBoundingClientRect();
    if (
      rect.bottom >= window.innerHeight - BOTTOM_SLACK &&
      rect.top < window.innerHeight
    ) {
      lift = Math.max(lift, window.innerHeight - rect.top);
    }
  }
  return lift;
}
