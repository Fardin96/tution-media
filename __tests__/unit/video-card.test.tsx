import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { MockInstance } from "vitest";
import { VideoCard } from "@/components/video-card";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const VIDEO = "/videos/tutor-1.mp4";

// Controlled, like the showcase: the parent owns `playing` and toggles it on click.
function Harness({ video = VIDEO }: { video?: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <VideoCard
      title="Tanvir Ahmed"
      subtitle="Physics tutor"
      thumbnail="/assets/avatar-demo/tutor/tutor1.png"
      video={video}
      playing={playing}
      onHover={() => {}}
      onToggle={() => setPlaying((p) => !p)}
      label="Play Tanvir Ahmed's video"
      sizes="100vw"
    />
  );
}

/** Every observed target reports as on or off screen, like a real IntersectionObserver. */
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

describe("VideoCard", () => {
  let play: MockInstance<HTMLMediaElement["play"]>;

  beforeEach(() => {
    play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockReturnValue(Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders no video while the card is off screen", () => {
    stubIntersection(false);
    const { container } = render(<Harness />);
    expect(container.querySelector("video")).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it("mounts the video and plays it when pressed", () => {
    stubIntersection(false);
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Play Tanvir/ }));
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("src", VIDEO);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("keeps the video hidden until its first frame has loaded", () => {
    stubIntersection(false);
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Play Tanvir/ }));
    const video = container.querySelector("video")!;
    expect(video).toHaveClass("opacity-0");
    expect(video).not.toHaveClass("opacity-100");

    fireEvent.loadedData(video);
    expect(video).toHaveClass("opacity-100");
    expect(video).not.toHaveClass("opacity-0");
  });

  it("has no poster and no preload, so nothing downloads until play", () => {
    stubIntersection(false);
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Play Tanvir/ }));
    const video = container.querySelector("video")!;
    expect(video).not.toHaveAttribute("poster");
    expect(video).toHaveAttribute("preload", "none");
  });
});
