import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { BackToTop } from "@/components/back-to-top";

// Scroll handlers queue a frame; the test runs the queue so each measurement is deterministic.
let frames: FrameRequestCallback[] = [];

function flushFrames() {
  const queued = frames;
  frames = [];
  act(() => queued.forEach((run) => run(0)));
}

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  fireEvent.scroll(window);
  flushFrames();
}

function button() {
  return screen.getByRole("button", { name: "Back to top" });
}

// jsdom has no layout: getClientRects is empty unless the test says an element is rendered.
function fixture(
  tag: string,
  attrs: Record<string, string>,
  rendered = true,
): HTMLElement {
  const el = document.createElement(tag);
  el.setAttribute("data-fixture", "");
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  el.getClientRects = () =>
    (rendered ? [{} as DOMRect] : []) as unknown as DOMRectList;
  document.body.append(el);
  return el;
}

function placeAt(el: HTMLElement, top: number, bottom: number, height: number) {
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom,
      height,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
}

beforeEach(() => {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 800,
  });
  scrollTo(0);
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
    frames.push(run);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelectorAll("[data-fixture]").forEach((el) => el.remove());
});

describe("BackToTop", () => {
  it("appears after one viewport height by default", () => {
    render(<BackToTop />);

    scrollTo(800);
    expect(button()).toHaveAttribute("inert");

    scrollTo(801);
    expect(button()).not.toHaveAttribute("inert");
  });

  it("honours a threshold in viewport heights", () => {
    render(<BackToTop threshold={0.5} />);

    scrollTo(400);
    expect(button()).toHaveAttribute("inert");

    scrollTo(401);
    expect(button()).not.toHaveAttribute("inert");
  });

  it("lifts above a visible sticky action bar", () => {
    const bar = fixture("div", { "data-sticky-actions": "" });
    placeAt(bar, 720, 800, 80);
    // A bar below the fold must not lift the button.
    const offscreen = fixture("div", { "data-sticky-actions": "" });
    placeAt(offscreen, 900, 1000, 100);
    render(<BackToTop />);

    scrollTo(900);

    expect(button().style.translate).toBe("0 -80px");
  });

  it("re-measures when a sticky bar mounts without a scroll, and clears it when the bar goes", async () => {
    render(<BackToTop />);
    scrollTo(900);
    expect(button().style.translate).toBe("0 -0px");

    const bar = fixture("div", { "data-sticky-actions": "" });
    placeAt(bar, 720, 800, 80);
    // MutationObserver callbacks run as a microtask; the scheduled frame then measures.
    await Promise.resolve();
    flushFrames();
    expect(button().style.translate).toBe("0 -80px");

    bar.remove();
    await Promise.resolve();
    flushFrames();
    expect(button().style.translate).toBe("0 -0px");
  });

  it("moves focus to the first visible home link", () => {
    fixture("a", { "data-home-link": "", href: "/" }, false);
    const logo = fixture("a", { "data-home-link": "", href: "/dashboard" });
    render(<BackToTop />);
    scrollTo(900);

    fireEvent.click(button());

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(logo).toHaveFocus();
  });

  it("falls back to main when no home link is visible", () => {
    fixture("a", { "data-home-link": "", href: "/" }, false);
    const main = fixture("main", {});
    render(<BackToTop />);
    scrollTo(900);

    fireEvent.click(button());

    expect(main).toHaveFocus();
    expect(main).toHaveAttribute("tabindex", "-1");
  });
});
