import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BlockingOverlay } from "@/components/ui/blocking-overlay";

const LABEL = "Signing you out";

// The button lives in the RTL container, which is a direct child of document.body, so the
// overlay's inert pass marks the container (the body child) rather than the button itself.
const ui = (open: boolean) => (
  <>
    <button type="button">Pay now</button>
    <BlockingOverlay open={open} label={LABEL} />
  </>
);

describe("BlockingOverlay", () => {
  afterEach(() => {
    document.documentElement.style.overflow = "";
    document.body.removeAttribute("aria-busy");
  });

  it("renders only the status region when closed", () => {
    const { container } = render(ui(false));
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status.parentElement).toBe(document.body);
    expect(status).toHaveAttribute("data-blocking-overlay");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByText(LABEL)).not.toBeInTheDocument();
    expect(container.inert).not.toBe(true);
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body).not.toHaveAttribute("aria-busy");
  });

  it("shows the label inside the status region when open", () => {
    render(ui(true));
    const status = screen.getByRole("status");
    expect(within(status).getByText(LABEL)).toBeVisible();
  });

  it("makes the rest of the page inert, hides overflow and marks the body busy when open", () => {
    const { container } = render(ui(true));
    expect(container.inert).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body).toHaveAttribute("aria-busy", "true");
    // The overlay's own host must stay interactive.
    expect(screen.getByRole("status").inert).not.toBe(true);
  });

  it("restores inert, overflow and aria-busy when closed", () => {
    document.documentElement.style.overflow = "auto";
    const { container, rerender } = render(ui(false));
    rerender(ui(true));
    expect(container.inert).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");

    rerender(ui(false));
    expect(container.inert).toBe(false);
    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.body).not.toHaveAttribute("aria-busy");
    expect(screen.queryByText(LABEL)).not.toBeInTheDocument();
  });

  it("returns focus to the element focused before opening", () => {
    const { container, rerender } = render(ui(false));
    const button = container.querySelector("button") as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);

    rerender(ui(true));
    rerender(ui(false));
    expect(document.activeElement).toBe(button);
  });
});
