import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import * as React from "react";

// jsdom has no canvas support; the particle vanish effect is not unit-tested.
HTMLCanvasElement.prototype.getContext = vi.fn();

// Next/Image fill mode needs mocked dimensions in jsdom.
vi.mock("next/image", () => ({
  __esModule: true,
  default: function MockImage(
    props: React.ImgHTMLAttributes<HTMLImageElement>,
  ) {
    return React.createElement("img", {
      ...props,
      src: props.src,
      alt: props.alt,
      "data-testid": "next-image",
    });
  },
}));

afterEach(() => {
  cleanup();
});
