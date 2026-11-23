import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  adminDashboardApi,
  type CatalogItem,
  type DashboardLayout,
  type DashboardRange,
} from "@/lib/admin-dashboard";
import { AdminDashboard } from "@/components/admin/dashboard/admin-dashboard";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
  rerender: null as null | (() => void),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin",
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  useAdminMe: () => ({ adminUser: { name: "Ada Lovelace" } }),
}));

vi.mock("@/components/admin/dashboard/finder", () => ({
  DashboardFinder: () => <div>finder</div>,
}));

vi.mock("@/components/admin/dashboard/customize-sheet", () => ({
  CustomizeSheet: () => null,
}));

vi.mock("@/components/admin/dashboard/widget-body", () => ({
  WidgetBody: ({ payload }: { payload: { value: string } }) => (
    <p>value {payload.value}</p>
  ),
}));

const signups: CatalogItem = {
  id: "signups",
  generatedAt: "2026-11-23T00:00:00.000Z",
  title: "Sign-ups",
  description: "New accounts",
  definition: "",
  group: "people",
  kind: "kpi",
  span: 3,
  keywords: [],
  href: null,
  defaultOn: true,
} as unknown as CatalogItem;

const layout = {
  widgets: ["signups"],
  catalog: [signups],
  isDefault: true,
} as unknown as DashboardLayout;

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui = () => (
    <QueryClientProvider client={client}>
      <AdminDashboard />
    </QueryClientProvider>
  );
  const view = render(ui());
  nav.rerender = () => view.rerender(ui());
  return view;
}

/** The router is mocked, so a replace updates the search params and re-renders the page. */
nav.replace.mockImplementation((url: string) => {
  nav.search = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  nav.rerender?.();
});

function radio(name: string) {
  return screen.getByRole("radio", { name });
}

describe("AdminDashboard range", () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.search = "";
    nav.rerender = null;
    vi.spyOn(adminDashboardApi, "layout").mockResolvedValue(layout);
    vi
      .spyOn(adminDashboardApi, "widget")
      .mockImplementation(async (_id, range: DashboardRange) => ({
        id: "signups",
        generatedAt: "2026-11-23T00:00:00.000Z",
        range,
        data: { kind: "kpi", value: range === "30d" ? "100" : "900" } as never,
      })) as never;
  });

  it("moves the selection with ArrowRight and replaces the URL with ?range=90d", async () => {
    renderDashboard();
    await screen.findByRole("heading", { name: "Sign-ups" });

    fireEvent.keyDown(radio("30 days"), { key: "ArrowRight" });

    expect(nav.replace).toHaveBeenCalledWith("/dashboard/admin?range=90d", {
      scroll: false,
    });
    await waitFor(() =>
      expect(radio("90 days")).toHaveAttribute("aria-checked", "true"),
    );
    expect(radio("30 days")).toHaveAttribute("aria-checked", "false");
  });

  it("removes the param when 30 days is chosen", async () => {
    nav.search = "range=90d";
    renderDashboard();
    await screen.findByRole("heading", { name: "Sign-ups" });

    fireEvent.click(radio("30 days"));

    expect(nav.replace).toHaveBeenCalledWith("/dashboard/admin", {
      scroll: false,
    });
    await waitFor(() =>
      expect(radio("30 days")).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("keeps the previous widget content visible while the new range loads", async () => {
    renderDashboard();
    await screen.findByText("value 100");

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(adminDashboardApi.widget).mockImplementationOnce(
      async (_id, range) => {
        await gate;
        return {
          id: "signups",
          generatedAt: "2026-11-23T00:00:00.000Z",
          range,
          data: { kind: "kpi", value: "900" } as never,
        } as never;
      },
    );

    fireEvent.click(radio("90 days"));
    await waitFor(() =>
      expect(radio("90 days")).toHaveAttribute("aria-checked", "true"),
    );

    const card = document.querySelector('[data-widget-id="signups"]');
    expect(card).not.toHaveAttribute("data-state", "loading");
    expect(card).toHaveAttribute("data-state", "ready");
    expect(screen.getByText("value 100")).toBeInTheDocument();

    await act(async () => {
      release();
    });
    await screen.findByText("value 900");
  });
});
