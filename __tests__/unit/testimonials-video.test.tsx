import { render } from "@testing-library/react";
import type { MockInstance } from "vitest";
import { Testimonials } from "@/components/testimonials";
import { SITE_CONTENT_DEFAULTS as D } from "@/lib/site-content";

const motionState = vi.hoisted(() => ({ reduced: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => motionState.reduced,
}));

const VIDEO = "/videos/testimonial-1.mp4";
const withVideo = {
  ...D.testimonials,
  items: [{ ...D.testimonials.items[0], video: VIDEO }],
};
const withoutVideo = {
  ...D.testimonials,
  items: [D.testimonials.items[0]],
};

// jsdom has no IntersectionObserver; useInView needs one. Every target reports the same
// state, so the video mounts only when the carousel counts as near the viewport.
function stubIntersection(isIntersecting: boolean) {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        this.callback(
          [{ isIntersecting, target } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

describe("Testimonials video", () => {
  let play: MockInstance<HTMLMediaElement["play"]>;

  beforeEach(() => {
    motionState.reduced = false;
    stubIntersection(true);
    play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockReturnValue(Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (navigator as { connection?: unknown }).connection;
  });

  it("renders a muted, looping, inline video with no poster and no preload", () => {
    const { container } = render(<Testimonials content={withVideo} />);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("src", VIDEO);
    expect(video!.muted).toBe(true);
    expect(video!.loop).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    // The photo underneath is the stand-in; a poster would download it a second time.
    expect(video).not.toHaveAttribute("poster");
    expect(video).toHaveAttribute("preload", "none");
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video).not.toHaveAttribute("controls");
  });

  it("does not autoplay when reduced motion is on", () => {
    motionState.reduced = true;
    const { container } = render(<Testimonials content={withVideo} />);
    expect(container.querySelector("video")).not.toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it("renders no video for an item without one", () => {
    const { container } = render(<Testimonials content={withoutVideo} />);
    expect(container.querySelector("video")).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it("does not autoplay when Save-Data is on", () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: {
        saveData: true,
        addEventListener() {},
        removeEventListener() {},
      },
    });
    const { container } = render(<Testimonials content={withVideo} />);
    expect(container.querySelector("video")).not.toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it("mounts no video while the carousel is not near the viewport", () => {
    stubIntersection(false);
    const { container } = render(<Testimonials content={withVideo} />);
    expect(container.querySelector("video")).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });
});
