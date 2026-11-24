import { afterEach, describe, expect, it, vi } from "vitest";
import { drawAttention } from "@/lib/attention";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("drawAttention", () => {
  it("returns false when nothing has the id", () => {
    expect(drawAttention("missing")).toBe(false);
  });

  it("blinks and focuses a section already in view, then clears the blink", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<section id="verification"><h2>ID</h2></section>`;
    const el = document.getElementById("verification")!;

    expect(drawAttention("verification")).toBe(true);
    await Promise.resolve();
    expect(el).toHaveAttribute("data-attention");
    expect(el).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(el);

    vi.advanceTimersByTime(2000);
    expect(el).not.toHaveAttribute("data-attention");
  });

  it("scrolls a section out of view into place before it blinks", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<section id="videos"></section>`;
    const el = document.getElementById("videos")!;
    el.getBoundingClientRect = () => ({ top: 5000, bottom: 5400 }) as DOMRect;
    el.scrollIntoView = vi.fn();

    drawAttention("videos");
    expect(el.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "center" }),
    );
    await Promise.resolve();
    expect(el).not.toHaveAttribute("data-attention");

    window.dispatchEvent(new Event("scrollend"));
    await Promise.resolve();
    expect(el).toHaveAttribute("data-attention");
  });
});
