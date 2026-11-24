import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReturnToBanner } from "@/components/ui/return-to-banner";
import { setReturnTo, readReturnTo } from "@/lib/return-to";

let pathname = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

beforeEach(() => {
  window.sessionStorage.clear();
  pathname = "/dashboard";
});

describe("ReturnToBanner", () => {
  it("shows the saved fix as a labelled landmark on another page", () => {
    setReturnTo("/dashboard/tutor/packages/new", "new package");
    render(<ReturnToBanner />);
    const bar = screen.getByRole("complementary", {
      name: "Return to your form",
    });
    expect(within(bar).getByText("Fixed it?")).toBeVisible();
    expect(
      within(bar).getByRole("link", { name: "Back to your new package" }),
    ).toHaveAttribute("href", "/dashboard/tutor/packages/new");
  });

  it("floats at the bottom of the screen and is a sticky action bar", () => {
    setReturnTo("/dashboard/tutor/packages/new", "new package");
    render(<ReturnToBanner />);
    const bar = screen.getByRole("complementary", {
      name: "Return to your form",
    });
    expect(bar).toHaveAttribute("data-sticky-actions");
    expect(bar).toHaveClass(
      "fixed",
      "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
    );
  });

  it("renders nothing on the target page and pops that entry", () => {
    pathname = "/dashboard/tutor/packages/new";
    setReturnTo("/dashboard/tutor/packages/new", "new package");
    render(<ReturnToBanner />);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(readReturnTo()).toBeNull();
  });

  it("reaching the top page shows the next trip from there", () => {
    setReturnTo("/dashboard/find-tuitions", "search");
    setReturnTo("/dashboard/tutor/packages/new", "new package");
    pathname = "/dashboard/tutor/packages/new";
    render(<ReturnToBanner />);
    expect(
      screen.getByRole("link", { name: "Back to your search" }),
    ).toBeInTheDocument();
    expect(readReturnTo()).toMatchObject({ label: "search" });
  });

  it("dismiss removes the shown trip and names it in the button", async () => {
    const user = userEvent.setup();
    setReturnTo("/dashboard/find-tuitions", "search");
    render(<ReturnToBanner />);
    await user.click(
      screen.getByRole("button", {
        name: "Dismiss the way back to your search",
      }),
    );
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(readReturnTo()).toBeNull();
  });
});
