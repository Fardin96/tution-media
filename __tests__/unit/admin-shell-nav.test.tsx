import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AdminShell,
  ADMIN_NAV,
  visibleAdminNav,
} from "@/components/admin/admin-shell";

const state = vi.hoisted(() => ({ isSuperAdmin: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/areas",
}));

vi.mock("@/lib/admin", () => ({
  useAdminMe: () => ({
    adminUser: { name: "Nadia Rahman", adminRole: "ADMIN", status: "ACTIVE" },
    isActive: true,
    isPending: false,
    isSuperAdmin: state.isSuperAdmin,
  }),
}));

vi.mock("@/components/auth/logout-button", () => ({
  LogoutButton: () => null,
  logoutTriggerClass: "",
}));

const LINK = "Schools and universities";

beforeEach(() => {
  state.isSuperAdmin = false;
  // The shell watches the lg breakpoint; jsdom has no matchMedia.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe("admin nav for super admins", () => {
  it("places the schools page after Areas and marks it super-admin only", () => {
    const labels = ADMIN_NAV.map((item) => item.label);
    expect(labels[labels.indexOf("Areas") + 1]).toBe(LINK);
    const item = ADMIN_NAV.find((entry) => entry.label === LINK);
    expect(item).toMatchObject({
      href: "/dashboard/admin/institutions",
      superAdminOnly: true,
    });
  });

  it("leaves the page out for a plain admin and keeps the rest", () => {
    const visible = visibleAdminNav(false).map((item) => item.label);
    expect(visible).not.toContain(LINK);
    expect(visible).toContain("Areas");
    expect(visibleAdminNav(true).map((item) => item.label)).toContain(LINK);
  });

  it("hides the link in the sidebar for a plain admin", () => {
    render(
      <AdminShell>
        <p>Page body</p>
      </AdminShell>,
    );
    expect(screen.queryByRole("link", { name: LINK })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Areas" })).toBeInTheDocument();
  });

  it("shows the link in the sidebar for a super admin", () => {
    state.isSuperAdmin = true;
    render(
      <AdminShell>
        <p>Page body</p>
      </AdminShell>,
    );
    expect(screen.getByRole("link", { name: LINK })).toHaveAttribute(
      "href",
      "/dashboard/admin/institutions",
    );
  });
});
