import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DashboardLayout } from "@/lib/admin-dashboard";
import { DashboardFinder } from "@/components/admin/dashboard/finder";
import { jumpToWidget } from "@/components/admin/dashboard/jump";

const FULL_MESSAGE = "Your dashboard is full. Remove a widget in Customize.";

const push = vi.fn();
const mutateAsync = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("motion/react", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@/lib/admin-dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-dashboard")>()),
  useAddDashboardWidget: () => ({ mutateAsync }),
}));

vi.mock("@/components/admin/dashboard/jump", () => ({
  jumpToWidget: vi.fn(async () => true),
}));

function item(
  id: DashboardLayout["catalog"][number]["id"],
  title: string,
  keywords: string[],
): DashboardLayout["catalog"][number] {
  return {
    id,
    title,
    description: `${title} description`,
    definition: `${title} definition`,
    group: "pipeline",
    kind: "kpi",
    span: 3,
    keywords,
    href: null,
    defaultOn: true,
  };
}

const layout = {
  catalog: [
    item("mau", "Monthly active users", ["mau", "active"]),
    item("bottleneck", "Where it's stuck", ["bottleneck", "funnel", "stuck"]),
    item("signups", "Sign-ups", []),
    item("collected", "Fees over time", ["revenue", "payments"]),
  ],
  widgets: ["mau", "bottleneck"],
} as unknown as DashboardLayout;

function input() {
  return screen.getByRole("combobox", { name: "Find a widget or page" });
}

function type(value: string) {
  fireEvent.change(input(), { target: { value } });
}

beforeEach(() => {
  push.mockReset();
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(layout);
  vi.mocked(jumpToWidget).mockClear();
});

describe("DashboardFinder", () => {
  it("shows ranked options with their dashboard tags", () => {
    render(<DashboardFinder layout={layout} />);
    type("mau");
    const option = screen.getByRole("option", { name: /Monthly active users/ });
    expect(option).toHaveTextContent("On your dashboard");
    expect(screen.getAllByRole("option")[0]).toBe(option);
  });

  it("jumps to an on-dashboard widget with ArrowDown and Enter", async () => {
    render(<DashboardFinder layout={layout} />);
    type("monthly");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });
    await waitFor(() =>
      expect(jumpToWidget).toHaveBeenCalledWith(
        "mau",
        expect.objectContaining({ reducedMotion: false }),
      ),
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("adds then jumps to a widget that is not on the dashboard", async () => {
    render(<DashboardFinder layout={layout} />);
    type("sign");
    const option = screen.getByRole("option", { name: /Sign-ups/ });
    expect(option).toHaveTextContent("Not on your dashboard");
    expect(option).toHaveTextContent("Add and jump");
    fireEvent.click(option);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith("signups"));
    await waitFor(() =>
      expect(jumpToWidget).toHaveBeenCalledWith("signups", expect.anything()),
    );
    expect(mutateAsync.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(jumpToWidget).mock.invocationCallOrder[0],
    );
  });

  it("pushes the route for a page", () => {
    render(<DashboardFinder layout={layout} />);
    type("packages");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/dashboard/admin/packages");
    expect(jumpToWidget).not.toHaveBeenCalled();
  });

  it("Ctrl+K focuses the input", () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <DashboardFinder layout={layout} />
      </>,
    );
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(input()).toHaveFocus();
  });

  it("Ctrl+K leaves an open dialog's own inputs alone", () => {
    render(
      <>
        <div role="dialog" data-state="open" />
        <DashboardFinder layout={layout} />
      </>,
    );
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(input()).not.toHaveFocus();
  });

  it("Ctrl+K works when the dialog is closed", () => {
    render(
      <>
        <div role="dialog" data-state="closed" />
        <DashboardFinder layout={layout} />
      </>,
    );
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(input()).toHaveFocus();
  });

  it("renders no shortcut on the server and shows it after mount", () => {
    expect(renderToString(<DashboardFinder layout={layout} />)).not.toMatch(
      /⌘K|Ctrl K/,
    );
    render(<DashboardFinder layout={layout} />);
    expect(screen.getByText("Ctrl K")).toBeInTheDocument();
  });

  it("holds the input busy and announces the add until the jump finishes", async () => {
    let finishJump!: () => void;
    vi.mocked(jumpToWidget).mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishJump = () => resolve(true);
        }),
    );
    render(<DashboardFinder layout={layout} />);
    type("sign");
    fireEvent.click(screen.getByRole("option", { name: /Sign-ups/ }));

    await waitFor(() => expect(input()).toBeDisabled());
    expect(input()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Adding Sign-ups…")).toBeInTheDocument();

    finishJump();
    await waitFor(() => expect(input()).toBeEnabled());
    expect(input()).not.toHaveAttribute("aria-busy");
  });

  it("announces when the dashboard is full instead of adding", () => {
    const full = {
      ...layout,
      widgets: Array.from({ length: 24 }, (_, i) => `w${i}`),
    } as unknown as DashboardLayout;
    render(<DashboardFinder layout={full} />);
    type("sign");
    fireEvent.click(screen.getByRole("option", { name: /Sign-ups/ }));
    expect(screen.getByText(FULL_MESSAGE)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("announces when the widget is not on the page after a jump", async () => {
    vi.mocked(jumpToWidget).mockResolvedValueOnce(false);
    render(<DashboardFinder layout={layout} />);
    type("monthly");
    fireEvent.keyDown(input(), { key: "Enter" });
    await waitFor(() =>
      expect(
        screen.getByText("That widget isn't on the page."),
      ).toBeInTheDocument(),
    );
  });

  it("Escape closes the list, and a second Escape clears the text", () => {
    render(<DashboardFinder layout={layout} />);
    type("mau");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input()).toHaveValue("");
  });

  it("announces No results when nothing matches", () => {
    render(<DashboardFinder layout={layout} />);
    type("zzzz");
    expect(screen.getByRole("status")).toHaveTextContent("No results");
  });
});
