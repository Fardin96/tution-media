// Scrolls a dashboard section into view, then blinks its outline twice (`[data-attention]` in globals.css).

const BLINK_MS = 2000;
const SETTLE_CAP_MS = 900;

function inView(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
}

// Resolves on scrollend, or after a cap for browsers without it.
function scrollSettled(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener("scrollend", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, SETTLE_CAP_MS);
    window.addEventListener("scrollend", done, { once: true });
  });
}

/** Returns false when no element has that id, so the caller can fall back to a plain link. */
export function drawAttention(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const settled = inView(el) ? Promise.resolve() : scrollSettled();
  if (!inView(el)) {
    el.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
  }
  void settled.then(() => {
    // Restart the animation when the same section is picked twice in a row.
    el.removeAttribute("data-attention");
    void el.offsetWidth;
    el.setAttribute("data-attention", "");
    window.setTimeout(() => el.removeAttribute("data-attention"), BLINK_MS);
    if (!el.matches("a, button, input, select, textarea, [tabindex]")) {
      el.setAttribute("tabindex", "-1");
    }
    el.focus({ preventScroll: true });
  });
  return true;
}
