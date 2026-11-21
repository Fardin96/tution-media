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

describe("Testimonials video", () => {
  let play: MockInstance<HTMLMediaElement["play"]>;

  beforeEach(() => {
    motionState.reduced = false;
    // jsdom has no IntersectionObserver; useInView needs one.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockReturnValue(Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders a muted, looping, inline video with the photo as poster", () => {
    const { container } = render(<Testimonials content={withVideo} />);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("src", VIDEO);
    expect(video!.muted).toBe(true);
    expect(video!.loop).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("poster", D.testimonials.items[0].photo);
    expect(video).toHaveAttribute("preload", "metadata");
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
});
