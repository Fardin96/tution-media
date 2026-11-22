import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SpinnerEllipsis from "@/components/shadcn-space/spinner/spinner-05";
import { Skeleton } from "@/components/ui/skeleton";

describe("SpinnerEllipsis", () => {
  it("renders three dots with staggered animation delays", () => {
    const { container } = render(<SpinnerEllipsis />);
    const dots = container.querySelectorAll("span");
    expect(dots).toHaveLength(3);
    expect(Array.from(dots, (dot) => dot.style.animationDelay)).toEqual([
      "0s",
      "0.2s",
      "0.4s",
    ]);
    dots.forEach((dot) => expect(dot).toHaveClass("spinner-ellipsis-dot"));
  });

  it("is hidden from screen readers", () => {
    const { container } = render(<SpinnerEllipsis />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveClass("flex", "items-center");
  });

  it("merges className into the root and lets it override base classes", () => {
    const { container } = render(
      <SpinnerEllipsis className="gap-4 text-red-500" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("flex", "items-center", "gap-4", "text-red-500");
    expect(root).not.toHaveClass("gap-1.5");
  });

  it("is also available as a named export", async () => {
    const mod = await import("@/components/shadcn-space/spinner/spinner-05");
    expect(mod.SpinnerEllipsis).toBe(mod.default);
  });
});

describe("Skeleton", () => {
  it("is hidden from screen readers with a data-slot marker", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("data-slot", "skeleton");
    expect(el).toHaveClass("rounded-md", "bg-[var(--color-skeleton)]");
  });

  it("merges className and lets it override conflicting classes", () => {
    const { container } = render(<Skeleton className="h-4 w-24 bg-red-500" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("h-4", "w-24", "bg-red-500", "overflow-hidden");
    expect(el).not.toHaveClass("bg-[var(--color-skeleton)]");
  });

  it("passes other props through to the element", () => {
    render(
      <Skeleton
        data-testid="tutor-skeleton"
        id="loading-tutor"
        title="loading"
        className="h-10"
      />,
    );
    const el = screen.getByTestId("tutor-skeleton");
    expect(el).toHaveAttribute("id", "loading-tutor");
    expect(el).toHaveAttribute("title", "loading");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveClass("h-10");
  });
});
