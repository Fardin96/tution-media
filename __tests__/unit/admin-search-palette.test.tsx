import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DashboardLayout } from "@/lib/admin-dashboard";
import { queryKeys } from "@/lib/query-keys";
import { AdminSearch } from "@/components/admin/admin-search";
import { jumpToWidget } from "@/components/admin/dashboard/jump";
import type { NavPage } from "@/lib/admin-search";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: "/dashboard/admin/payments",
}));
const mutateAsync = vi.hoisted(() => vi.fn());
const apiGet = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}));

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => false,
}));

vi.mock("@/lib/admin-dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-dashboard")>()),
  useAddDashboardWidget: () => ({ mutateAsync }),
}));

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  client: { GET: apiGet },
}));

vi.mock("@/components/admin/dashboard/jump", () => ({
  jumpToWidget: vi.fn(async () => true),
}));

const NAV: NavPage[] = [
  { href: "/dashboard/admin", label: "Dashboard", description: "Home." },
  {
    href: "/dashboard/admin/payments",
    label: "Payments",
    description: "Online payments.",
  },
  {
    href: "/dashboard/admin/packages",
    label: "Packages",
    description: "Approve packages.",
  },
  {
    href: "/dashboard/admin/accounts",
    label: "Accounts",
    description: "Find people.",
  },
];

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
  } as unknown as DashboardLayout["catalog"][number];
}

const layout = {
  catalog: [
    item("mau", "Monthly active users", ["mau", "active"]),
    item("bottleneck", "Where it's stuck", ["bottleneck"]),
    item("signups", "Sign-ups", []),
  ],
  widgets: ["mau", "bottleneck"],
} as unknown as DashboardLayout;

const NUSRAT = {
  id: "t_1",
  email: "nusrat@example.test",
  role: "TUTOR",
  status: "ACTIVE",
  name: "Nusrat Jahan",
  phoneNumber: null,
  phoneVerifiedAt: null,
  avatarUrl: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  lastLoginAt: null,
  deletedAt: null,
};

function renderPalette(pathname = "/dashboard/admin/payments") {
  nav.pathname = pathname;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(queryKeys.admin.dashboard.layout, layout);

  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <QueryClientProvider client={client}>
        <AdminSearch open={open} onOpenChange={setOpen} pages={NAV} />
      </QueryClientProvider>
    );
  }
  render(<Harness />);
}

function openPalette() {
  fireEvent.keyDown(document, { key: "k", ctrlKey: true });
  return screen.findByRole("dialog", { name: "Search admin" });
}

function input() {
  return screen.getByRole("combobox", { name: "Search admin" });
}

function type(value: string) {
  fireEvent.change(input(), { target: { value } });
}

async function closed() {
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Search admin" })).toBeNull(),
  );
}

beforeEach(() => {
  nav.push.mockReset();
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(layout);
  apiGet.mockReset();
  apiGet.mockImplementation(async (path: string) => ({
    data:
      path === "/api/v1/admin/accounts"
        ? { accounts: [NUSRAT], nextCursor: null }
        : layout,
    response: { ok: true },
  }));
  vi.mocked(jumpToWidget).mockClear();
});

describe("AdminSearch", () => {
  it("Ctrl+K opens the palette on a non-dashboard page", async () => {
    renderPalette("/dashboard/admin/payments");
    await openPalette();
    expect(input()).toHaveFocus();
  });

  it("Ctrl+K closes the open palette", async () => {
    renderPalette();
    await openPalette();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    await closed();
  });

  it("does not open over another open dialog", () => {
    renderPalette();
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    other.setAttribute("data-state", "open");
    document.body.appendChild(other);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog", { name: "Search admin" })).toBeNull();
    other.remove();
  });

  it("lists every page for an empty query", async () => {
    renderPalette();
    await openPalette();
    const pages = screen.getByRole("group", { name: "Pages" });
    const options = within(pages).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Dashboard"),
      expect.stringContaining("Payments"),
      expect.stringContaining("Packages"),
      expect.stringContaining("Accounts"),
    ]);
    expect(screen.queryByRole("group", { name: "Views" })).toBeNull();
  });

  it("shows the payments page and its views for 'pay'", async () => {
    renderPalette();
    await openPalette();
    type("pay");
    const pages = screen.getByRole("group", { name: "Pages" });
    expect(
      within(pages).getByRole("option", { name: /Payments/ }),
    ).toBeInTheDocument();
    const views = screen.getByRole("group", { name: "Views" });
    expect(
      within(views).getByRole("option", { name: /Payments · Needs attention/ }),
    ).toBeInTheDocument();
    expect(
      within(views).getByRole("option", { name: /Payments · Failed/ }),
    ).toBeInTheDocument();
    // Three characters start a people search, so the status reads "Searching people…" until it settles.
    await waitFor(() =>
      expect(
        document.querySelector(".sr-only[role='status']"),
      ).toHaveTextContent(/results?$/),
    );
  });

  it("wires the combobox to the active option", async () => {
    renderPalette();
    await openPalette();
    expect(input()).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(input()).toHaveAttribute("aria-controls", listbox.id);
    expect(input()).toHaveAttribute("aria-autocomplete", "list");
    const first = screen.getAllByRole("option")[0]!;
    expect(input()).toHaveAttribute("aria-activedescendant", first.id);
    expect(first).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input(), { key: "End" });
    const last = screen.getAllByRole("option").at(-1)!;
    expect(input()).toHaveAttribute("aria-activedescendant", last.id);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("searches people through the accounts API after a debounce and opens the account", async () => {
    renderPalette();
    await openPalette();
    type("nusrat");

    expect(apiGet).not.toHaveBeenCalledWith(
      "/api/v1/admin/accounts",
      expect.anything(),
    );
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/admin/accounts", {
        params: { query: { q: "nusrat", limit: 5 } },
      }),
    );

    const option = await screen.findByRole("option", { name: /Nusrat Jahan/ });
    const people = screen.getByRole("group", { name: "People" });
    expect(within(people).getByText("Tutor")).toBeInTheDocument();
    fireEvent.click(option);

    expect(nav.push).toHaveBeenCalledWith("/dashboard/admin/accounts/t_1");
    await closed();
  });

  it("shows the searching status and a quiet error row when people fail", async () => {
    apiGet.mockImplementation(async (path: string) =>
      path === "/api/v1/admin/accounts"
        ? Promise.reject(new Error("offline"))
        : { data: layout, response: { ok: true } },
    );
    renderPalette();
    await openPalette();
    type("nus");
    // The one status message carries the people state; no status role sits inside the listbox.
    expect(screen.getByRole("status", { hidden: false })).toHaveTextContent(
      "Searching people…",
    );
    await waitFor(
      () =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Couldn't search people.",
        ),
      { timeout: 3000 },
    );
    const row = screen.getByText("Couldn't search people.", { selector: "p" });
    expect(row).toHaveAttribute("aria-hidden", "true");
    expect(row.closest("[role='listbox']")).toBeNull();
    expect(row.closest("[role='group']")).toBeNull();
    expect(row.closest("[role='status']")).toBeNull();
  });

  it("keeps focus in the input while a widget is being added", async () => {
    let finish!: () => void;
    mutateAsync.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    renderPalette();
    await openPalette();
    type("sign");
    fireEvent.click(await screen.findByRole("option", { name: /Sign-ups/ }));

    await waitFor(() => expect(input()).toHaveAttribute("aria-busy", "true"));
    expect(input()).not.toBeDisabled();
    expect(input()).toHaveAttribute("readonly");
    expect(input()).toHaveAttribute("aria-disabled", "true");
    expect(input()).toHaveFocus();
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(nav.push).not.toHaveBeenCalled();

    await waitFor(() => expect(finish).toBeDefined());
    finish();
    await closed();
  });

  it("announces a failed add inside the open palette", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("offline"));
    renderPalette();
    await openPalette();
    type("sign");
    fireEvent.click(await screen.findByRole("option", { name: /Sign-ups/ }));

    const dialog = screen.getByRole("dialog", { name: "Search admin" });
    await waitFor(() =>
      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "Couldn't add that widget.",
      ),
    );
    expect(screen.getByRole("dialog", { name: "Search admin" })).toBeVisible();
  });

  it("jumps to a widget on the dashboard without navigating", async () => {
    renderPalette("/dashboard/admin");
    await openPalette();
    type("monthly");
    fireEvent.click(
      screen.getByRole("option", { name: /Monthly active users/ }),
    );
    await closed();
    await waitFor(() =>
      expect(jumpToWidget).toHaveBeenCalledWith("mau", expect.anything()),
    );
    expect(nav.push).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("adds a widget from another page, then opens the dashboard with ?focus", async () => {
    renderPalette("/dashboard/admin/payments");
    await openPalette();
    type("sign");
    const option = screen.getByRole("option", { name: /Sign-ups/ });
    expect(option).toHaveTextContent("Not on your dashboard");
    fireEvent.click(option);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith("signups"));
    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith("/dashboard/admin?focus=signups"),
    );
    expect(jumpToWidget).not.toHaveBeenCalled();
  });

  it("shows a widget that is on the dashboard from another page with ?focus", async () => {
    renderPalette("/dashboard/admin/payments");
    await openPalette();
    type("monthly");
    fireEvent.click(
      screen.getByRole("option", { name: /Monthly active users/ }),
    );
    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith("/dashboard/admin?focus=mau"),
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("Escape closes the palette", async () => {
    renderPalette();
    await openPalette();
    fireEvent.keyDown(input(), { key: "Escape" });
    await closed();
  });
});
