import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  blink,
  jumpToWidget,
  waitForSettle,
  waitForWidget,
} from "@/components/admin/dashboard/jump";

// A fake frame clock: each runFrame() advances time by 16 ms and runs queued callbacks.
function frameClock() {
  let time = 0;
  let queue: FrameRequestCallback[] = [];
  const raf = (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  };
  const runFrame = () => {
    time += 16;
    const run = queue;
    queue = [];
    run.forEach((cb) => cb(time));
  };
  return { raf, now: () => time, runFrame };
}

/** Runs frames until the promise settles; returns the fake time it took. */
async function settle(
  promise: Promise<void>,
  clock: ReturnType<typeof frameClock>,
  onFrame: () => void,
  maxFrames = 500,
) {
  let done = false;
  promise.then(() => (done = true));
  const start = clock.now();
  for (let i = 0; i < maxFrames && !done; i++) {
    onFrame();
    clock.runFrame();
    await Promise.resolve();
    await Promise.resolve();
  }
  return { done, elapsed: clock.now() - start };
}

describe("waitForSettle", () => {
  it("resolves immediately when already in place", async () => {
    const clock = frameClock();
    await expect(
      waitForSettle(() => 100, 100, { raf: clock.raf, now: clock.now }),
    ).resolves.toBeUndefined();
  });

  it("reaches the target after a few frames", async () => {
    const clock = frameClock();
    let top = 400;
    let scrollY = 0;
    const p = waitForSettle(() => top, 100, {
      raf: clock.raf,
      now: clock.now,
      getScrollY: () => scrollY,
    });
    const { done, elapsed } = await settle(p, clock, () => {
      top = Math.max(100, top - 100);
      scrollY += 100;
    });
    expect(done).toBe(true);
    expect(elapsed).toBeLessThan(200);
  });

  it("resolves in under 500 ms when a clamped scroll stops short of the target", async () => {
    const clock = frameClock();
    let frame = 0;
    let scrollY = 0;
    const p = waitForSettle(() => Math.max(150, 300 - scrollY * 5), 100, {
      raf: clock.raf,
      now: clock.now,
      getScrollY: () => scrollY,
    });
    const { done, elapsed } = await settle(p, clock, () => {
      frame++;
      if (frame <= 3) scrollY += 10;
    });
    expect(done).toBe(true);
    expect(elapsed).toBeLessThan(500);
  });

  it("gives up at about 200 ms when the scroll never starts", async () => {
    const clock = frameClock();
    const p = waitForSettle(() => 300, 100, {
      raf: clock.raf,
      now: clock.now,
      getScrollY: () => 0,
    });
    const { done, elapsed } = await settle(p, clock, () => {});
    expect(done).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(200);
    expect(elapsed).toBeLessThanOrEqual(232);
  });

  it("stops at the 1.5 s hard cap", async () => {
    const clock = frameClock();
    let scrollY = 0;
    const p = waitForSettle(() => 300, 100, {
      raf: clock.raf,
      now: clock.now,
      getScrollY: () => scrollY,
    });
    const { done, elapsed } = await settle(p, clock, () => {
      scrollY += 1; // keeps moving, so only the cap can end it
    });
    expect(done).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(1500);
    expect(elapsed).toBeLessThanOrEqual(1520);
  });
});

describe("blink", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets data-blink and clears it on animationend", () => {
    const el = document.createElement("li");
    document.body.appendChild(el);
    blink(el);
    expect(el.hasAttribute("data-blink")).toBe(true);
    el.dispatchEvent(new Event("animationend"));
    expect(el.hasAttribute("data-blink")).toBe(false);
    el.remove();
  });

  it("clears data-blink after 2.5 s without an animation event", () => {
    const el = document.createElement("li");
    document.body.appendChild(el);
    blink(el);
    vi.advanceTimersByTime(2499);
    expect(el.hasAttribute("data-blink")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(el.hasAttribute("data-blink")).toBe(false);
    el.remove();
  });
});

function addWidget(id: string, state: string, title = "Monthly active users") {
  const li = document.createElement("li");
  li.id = `widget-${id}`;
  li.dataset.state = state;
  li.innerHTML = `<h3 id="widget-${id}-title">${title}</h3><div data-widget-card tabindex="-1"></div>`;
  document.body.appendChild(li);
  return li;
}

describe("waitForWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("resolves once the widget's data-state leaves loading", async () => {
    const el = addWidget("mau", "loading");
    const p = waitForWidget("mau");
    await vi.advanceTimersByTimeAsync(64);
    el.dataset.state = "ready";
    await vi.advanceTimersByTimeAsync(32);
    await expect(p).resolves.toBe(el);
  });

  it("returns the element after the 3 s cap even while still loading", async () => {
    const el = addWidget("mau", "loading");
    let settled = false;
    const p = waitForWidget("mau").then((r) => {
      settled = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(2900);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await expect(p).resolves.toBe(el);
  });

  it("returns null when the widget is absent", async () => {
    const p = waitForWidget("missing");
    await vi.advanceTimersByTimeAsync(3100);
    await expect(p).resolves.toBeNull();
  });
});

describe("jumpToWidget", () => {
  let scrollBy: ReturnType<typeof vi.spyOn>;
  const announce = vi.fn<(msg: string) => void>();

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
    // jsdom has no layout: model a 200 px card and the viewport centre.
    Element.prototype.scrollIntoView = vi.fn();
    announce.mockClear();
    scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  /** Places the card's top where `top()` says it is; the target is (innerHeight - 200) / 2. */
  function place(el: HTMLElement, top: () => number) {
    el.getBoundingClientRect = () => ({ top: top(), height: 200 }) as DOMRect;
  }

  const target = () => (window.innerHeight - 200) / 2;

  it("focuses the card, announces the jump, and blinks the widget", async () => {
    const el = addWidget("mau", "ready");
    let top = 40;
    place(el, () => top);
    vi.mocked(Element.prototype.scrollIntoView).mockImplementation(() => {
      top = target();
    });

    const p = jumpToWidget("mau", { reducedMotion: false, announce });
    await vi.advanceTimersByTimeAsync(100);

    await expect(p).resolves.toBe(true);
    expect(document.activeElement).toBe(el.querySelector("[data-widget-card]"));
    expect(announce).toHaveBeenCalledWith("Jumped to Monthly active users");
    expect(el.hasAttribute("data-blink")).toBe(true);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("re-scrolls once when the card drifts more than 4 px from the target", async () => {
    const el = addWidget("mau", "ready");
    let top = 40;
    place(el, () => top);
    vi.mocked(Element.prototype.scrollIntoView).mockImplementation(() => {
      top = target() + 10;
    });
    scrollBy.mockImplementation(() => {
      top = target();
    });

    const p = jumpToWidget("mau", { reducedMotion: true, announce });
    await vi.advanceTimersByTimeAsync(400);

    await expect(p).resolves.toBe(true);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: 10 }));
  });

  it("returns false when the widget is not on the page", async () => {
    const p = jumpToWidget("missing", { reducedMotion: false, announce });
    await vi.advanceTimersByTimeAsync(3100);
    await expect(p).resolves.toBe(false);
    expect(announce).not.toHaveBeenCalled();
  });

  it("a jump started before the first settles makes the first return false", async () => {
    const a = addWidget("mau", "loading");
    const b = addWidget("collected", "ready", "Fees over time");
    place(a, () => 40);
    place(b, () => target());
    const first = jumpToWidget("mau", { reducedMotion: false, announce });
    const second = jumpToWidget("collected", {
      reducedMotion: false,
      announce,
    });

    await vi.advanceTimersByTimeAsync(64);
    a.dataset.state = "ready";
    await vi.advanceTimersByTimeAsync(400);

    await expect(second).resolves.toBe(true);
    await expect(first).resolves.toBe(false);
    expect(a.hasAttribute("data-blink")).toBe(false);
    expect(a.querySelector("[data-widget-card]")).not.toHaveFocus();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Jumped to Fees over time");
  });
});

describe("blink, one at a time", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("blinking a second element clears the first", () => {
    const a = document.createElement("li");
    const b = document.createElement("li");
    document.body.append(a, b);
    blink(a);
    blink(b);
    expect(a.hasAttribute("data-blink")).toBe(false);
    expect(b.hasAttribute("data-blink")).toBe(true);
  });
});
