// Jumping to a dashboard widget: wait for it to exist, scroll it into place, blink it.

type Frame = (cb: FrameRequestCallback) => number;

const HARD_CAP_MS = 1500;
const NO_SCROLL_MS = 200;
const BLINK_MS = 2500;

const nextFrame: Frame = (cb) =>
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame(cb)
    : (setTimeout(() => cb(performance.now()), 16) as unknown as number);

const clock = () => performance.now();

/**
 * Resolves once the element's top stops moving at the target. Smooth scrolls
 * settle on target; clamped scrolls (near the page end) settle short and are
 * detected by scrollY staying still; a scroll that never starts is given up after 200 ms.
 */
export function waitForSettle(
  getTop: () => number,
  targetTop: number,
  opts: {
    raf?: Frame;
    now?: () => number;
    getScrollY?: () => number;
  } = {},
): Promise<void> {
  const raf = opts.raf ?? nextFrame;
  const now = opts.now ?? clock;
  const getScrollY = opts.getScrollY ?? (() => window.scrollY);

  if (Math.abs(getTop() - targetTop) < 1) return Promise.resolve();

  return new Promise((resolve) => {
    const start = now();
    let lastY = getScrollY();
    let moved = false;
    let stillFrames = 0;
    let inTarget = 0;

    const tick = () => {
      const top = getTop();
      const y = getScrollY();
      const t = now();

      inTarget = Math.abs(top - targetTop) < 1 ? inTarget + 1 : 0;
      if (y !== lastY) {
        lastY = y;
        moved = true;
        stillFrames = 0;
      } else {
        stillFrames++;
      }

      if (
        inTarget >= 3 ||
        (moved && stillFrames >= 4) ||
        (!moved && t - start >= NO_SCROLL_MS) ||
        t - start >= HARD_CAP_MS
      ) {
        resolve();
        return;
      }
      raf(tick);
    };
    raf(tick);
  });
}

/**
 * Polls each frame for the widget's <li>, once its data has left "loading".
 * After capMs it returns the element even if still loading, so the jump still happens.
 */
export function waitForWidget(
  id: string,
  capMs = 3000,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const start = clock();
    const tick = () => {
      const el = document.getElementById(`widget-${id}`);
      if (el && el.dataset.state !== "loading") {
        resolve(el);
        return;
      }
      if (clock() - start >= capMs) {
        resolve(el);
        return;
      }
      nextFrame(tick);
    };
    tick();
  });
}

let activeBlink: { el: HTMLElement; clear: () => void } | null = null;

/** Flashes the element's highlight (CSS on li[data-blink]::after). One blink at a time. */
export function blink(el: HTMLElement) {
  activeBlink?.clear();

  el.removeAttribute("data-blink");
  void el.offsetWidth;
  el.setAttribute("data-blink", "");

  const onEnd = (e: Event) => {
    if (e.target === el) clear();
  };
  const timer = setTimeout(() => clear(), BLINK_MS);

  function clear() {
    clearTimeout(timer);
    el.removeEventListener("animationend", onEnd);
    el.removeEventListener("animationcancel", onEnd);
    el.removeAttribute("data-blink");
    if (activeBlink?.el === el) activeBlink = null;
  }

  el.addEventListener("animationend", onEnd);
  el.addEventListener("animationcancel", onEnd);
  activeBlink = { el, clear };
}

// Each jump takes a token; a jump that is overtaken by a newer one stops without side effects.
let jumpToken = 0;

/**
 * Scrolls the widget to the middle of the viewport (below the sticky toolbar),
 * blinks it, focuses its card and announces it. Resolves false when it isn't on the page,
 * or when a newer jump started before this one finished.
 */
export async function jumpToWidget(
  id: string,
  {
    reducedMotion,
    announce,
  }: { reducedMotion: boolean; announce: (msg: string) => void },
): Promise<boolean> {
  const token = ++jumpToken;
  const el = await waitForWidget(id);
  if (token !== jumpToken || !el) return false;

  const scrollMarginTop = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const height = el.getBoundingClientRect().height;
  const target = Math.max((window.innerHeight - height) / 2, scrollMarginTop);
  const getTop = () => el.getBoundingClientRect().top;

  el.scrollIntoView({
    block: "center",
    behavior: reducedMotion ? "auto" : "smooth",
  });
  await waitForSettle(getTop, target);
  if (token !== jumpToken) return false;

  const drift = getTop() - target;
  if (Math.abs(drift) > 4) {
    window.scrollBy({ top: drift, behavior: "instant" as ScrollBehavior });
  }

  blink(el);
  el.querySelector<HTMLElement>("[data-widget-card]")?.focus({
    preventScroll: true,
  });

  const title =
    document.getElementById(`widget-${id}-title`)?.textContent?.trim() ?? id;
  announce(`Jumped to ${title}`);
  return true;
}
