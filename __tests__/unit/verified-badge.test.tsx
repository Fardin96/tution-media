import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  VERIFIED_MEANING,
  VerifiedBadge,
  VerifiedBadgeTip,
} from "@/components/ui/verified-badge";

describe("VerifiedBadge", () => {
  it("is an image named Verified, described by its title", () => {
    render(<VerifiedBadge />);

    const badge = screen.getByRole("img", { name: "Verified" });
    expect(badge.querySelector("title")).toHaveTextContent(VERIFIED_MEANING);
  });

  it("takes the size and is not focusable", () => {
    render(<VerifiedBadge size={22} />);

    const badge = screen.getByRole("img", { name: "Verified" });
    expect(badge).toHaveAttribute("width", "22");
    expect(badge).toHaveAttribute("focusable", "false");
    expect(badge).not.toHaveAttribute("tabindex");
  });

  it("is hidden from assistive tech with no role or label when decorative", () => {
    const { container } = render(<VerifiedBadge decorative />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(svg).not.toHaveAttribute("aria-label");
    expect(svg?.querySelector("title")).toBeNull();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("draws the lobed outline with a filleted stroke in the verified colour", () => {
    const { container } = render(<VerifiedBadge />);

    const outline = container.querySelector("path");
    expect(outline).toHaveAttribute("stroke", "currentColor");
    expect(outline).toHaveAttribute("stroke-linejoin", "round");
    expect(container.querySelector("svg")).toHaveClass(
      "text-[var(--color-verified)]",
    );
  });

  it("sits on the text baseline through its base class, not at call sites", () => {
    const { container } = render(<VerifiedBadge />);

    expect(container.querySelector("svg")).toHaveClass("align-[-0.15em]");
  });
});

describe("VerifiedBadgeTip", () => {
  // Radix sizes the popover with ResizeObserver, which jsdom lacks.
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("is a button labelled Verified with a hit area of at least 24px", () => {
    render(<VerifiedBadgeTip />);

    const trigger = screen.getByRole("button", { name: "Verified" });
    expect(trigger).toHaveClass("min-h-6", "min-w-6", "-my-1");
  });

  it("shows the meaning when clicked", async () => {
    const user = userEvent.setup();
    render(<VerifiedBadgeTip />);

    await user.click(screen.getByRole("button", { name: "Verified" }));

    expect(await screen.findByText(VERIFIED_MEANING)).toBeInTheDocument();
  });

  it("closes on Escape and on an outside click", async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>Outside</p>
        <VerifiedBadgeTip />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Verified" });

    await user.click(trigger);
    expect(await screen.findByText(VERIFIED_MEANING)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await vi.waitFor(() =>
      expect(screen.queryByText(VERIFIED_MEANING)).not.toBeInTheDocument(),
    );

    await user.click(trigger);
    expect(await screen.findByText(VERIFIED_MEANING)).toBeInTheDocument();
    await user.click(screen.getByText("Outside"));
    await vi.waitFor(() =>
      expect(screen.queryByText(VERIFIED_MEANING)).not.toBeInTheDocument(),
    );
  });

  it("shows a visible Verified label when asked", () => {
    render(<VerifiedBadgeTip withLabel />);

    expect(screen.getByRole("button")).toHaveTextContent("Verified");
  });
});
