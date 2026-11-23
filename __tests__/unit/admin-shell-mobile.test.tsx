import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminShell } from "@/components/admin/admin-shell";

const state = vi.hoisted(() => ({
  pathname: "/dashboard/admin/accounts/acc-1",
  wide: { matches: false, listeners: [] as Array<() => void> },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));

vi.mock("@/lib/admin", () => ({
  useAdminMe: () => ({
    adminUser: { name: "Nadia Rahman", adminRole: "ADMIN", status: "ACTIVE" },
    isActive: true,
    isPending: false,
    isSuperAdmin: false,
  }),
}));

// The shell only passes props to the logout dialog; its own behaviour is covered by its own tests.
vi.mock("@/components/auth/logout-button", () => ({
  LogoutButton: () => null,
  logoutTriggerClass: "",
}));

function renderShell() {
  return render(
    <AdminShell>
      <p>Page body</p>
    </AdminShell>,
  );
}

function hamburger() {
  return screen.getByRole("button", { name: "Open admin menu" });
}

function drawer() {
  return screen.queryByRole("dialog", { name: "Admin menu" });
}

describe("AdminShell on narrow screens", () => {
  beforeEach(() => {
    state.pathname = "/dashboard/admin/accounts/acc-1";
    state.wide = { matches: false, listeners: [] };
    // jsdom has no layout or scrolling; the drawer scrolls the current item into view on open.
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = ((query: string) => ({
      get matches() {
        return state.wide.matches;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) =>
        state.wide.listeners.push(listener),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })) as unknown as typeof window.matchMedia;
  });

  it("opens the admin menu from the hamburger", async () => {
    renderShell();
    await userEvent.click(hamburger());

    const dialog = await screen.findByRole("dialog", { name: "Admin menu" });
    expect(
      within(dialog).getByRole("navigation", { name: "Admin" }),
    ).toBeInTheDocument();
  });

  it("shows the current page name in the top bar", () => {
    renderShell();
    const bar = hamburger().closest("header");
    expect(bar).toHaveTextContent("Accounts");
  });

  it("falls back to Admin when no nav item matches the page", () => {
    state.pathname = "/dashboard/admin/unlisted-page";
    renderShell();
    expect(hamburger().closest("header")).toHaveTextContent(/^Admin$/);
  });

  it("closes when a menu link is clicked", async () => {
    renderShell();
    await userEvent.click(hamburger());
    const dialog = await screen.findByRole("dialog", { name: "Admin menu" });

    await userEvent.click(within(dialog).getByRole("link", { name: "Fees" }));

    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
  });

  it("closes when the page changes underneath it", async () => {
    const { rerender } = renderShell();
    await userEvent.click(hamburger());
    await screen.findByRole("dialog", { name: "Admin menu" });

    state.pathname = "/dashboard/admin/fees";
    rerender(
      <AdminShell>
        <p>Page body</p>
      </AdminShell>,
    );

    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
  });

  it("closes when the viewport reaches the desktop breakpoint", async () => {
    renderShell();
    await userEvent.click(hamburger());
    await screen.findByRole("dialog", { name: "Admin menu" });

    state.wide.matches = true;
    act(() => state.wide.listeners.forEach((listener) => listener()));

    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
  });

  it("returns focus to the hamburger when the menu closes", async () => {
    renderShell();
    await userEvent.click(hamburger());
    await screen.findByRole("dialog", { name: "Admin menu" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(hamburger()).toHaveFocus());
  });
});
