import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardLoading from "@/app/dashboard/loading";
import AdminLoading from "@/app/dashboard/admin/loading";
import OnboardingLoading from "@/app/onboarding/loading";

describe("route loading shells", () => {
  it.each([
    ["dashboard", DashboardLoading],
    ["admin", AdminLoading],
    ["onboarding", OnboardingLoading],
  ])("%s announces a status with a sr-only label", (_name, Shell) => {
    const { container } = render(<Shell />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading…");
    expect(status.querySelector(".sr-only")).toHaveTextContent("Loading…");
    // Every placeholder bar is a Skeleton, hidden from assistive tech.
    const bars = container.querySelectorAll('[data-slot="skeleton"]');
    expect(bars.length).toBeGreaterThan(0);
    bars.forEach((bar) => expect(bar).toHaveAttribute("aria-hidden", "true"));
  });

  it("dashboard shell draws a header bar and three cards", () => {
    const { container } = render(<DashboardLoading />);
    expect(container.querySelector("header")).not.toBeNull();
    const cards = container.querySelectorAll("main > div");
    expect(cards).toHaveLength(3);
    cards.forEach((c) => expect(c.className).toContain("rounded-[20px]"));
  });

  it("admin shell draws three chips and four cards", () => {
    const { container } = render(<AdminLoading />);
    expect(container.querySelectorAll(".rounded-full.h-10")).toHaveLength(4);
    const cards = container.querySelectorAll(".rounded-\\[24px\\]");
    expect(cards).toHaveLength(4);
  });

  it("onboarding shell draws four step bars and two field skeletons", () => {
    const { container } = render(<OnboardingLoading />);
    const fields = container.querySelectorAll(".h-11");
    expect(fields).toHaveLength(2);
    expect(container.querySelector('[style*="repeat(4"]')).not.toBeNull();
  });
});
