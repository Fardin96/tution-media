import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminPromoCodesPage } from "@/components/admin/promo-codes-page";
import { apiFetch } from "@/lib/api";
import { useAdminMe } from "@/lib/admin";
import type { AdminPromoCode } from "@/lib/admin-promo-codes";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/promo-codes",
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  useAdminMe: vi.fn(),
}));

const LIST_PATH = "/api/v1/admin/promo-codes";
const CREATE_PATH = "/api/v1/admin/promo-codes";

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function promo(
  overrides: Partial<AdminPromoCode> & { id: string },
): AdminPromoCode {
  return {
    code: `CODE${overrides.id.toUpperCase()}`,
    description: null,
    discountType: "PERCENT",
    discountValue: "10.00",
    maxDiscount: null,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    maxPerTutor: 1,
    isActive: true,
    redemptionCount: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    createdByName: "Farabi",
    ...overrides,
  };
}

function asAdmin(isSuperAdmin: boolean) {
  vi.mocked(useAdminMe).mockReturnValue({
    isSuperAdmin,
    isSuccess: true,
  } as unknown as ReturnType<typeof useAdminMe>);
}

/** Serves the list; `create` answers the POST to the same collection. */
function mockApi(
  codes: AdminPromoCode[],
  create: (init?: RequestInit) => Response = () => respond({}, 500),
) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    if (init?.method === "POST" && pathname === CREATE_PATH) {
      return create(init);
    }
    if (pathname === LIST_PATH) {
      return respond({ promoCodes: codes, nextCursor: null });
    }
    return respond({ message: "Not mocked" }, 404);
  });
}

function requestedUrls(): URL[] {
  return vi
    .mocked(apiFetch)
    .mock.calls.map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === LIST_PATH);
}

function postsToCreate() {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(
      ([input, init]) =>
        init?.method === "POST" &&
        new URL(input, "http://localhost").pathname === CREATE_PATH,
    );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminPromoCodesPage />
    </QueryClientProvider>,
  );
}

async function openCreateDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "New code" }));
  return screen.findByRole("dialog");
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  asAdmin(true);
});

describe("AdminPromoCodesPage", () => {
  it("opens on the active view and requests active=true", async () => {
    mockApi([promo({ id: "a", code: "SUMMER10" })]);
    renderPage();

    expect(
      await screen.findByRole("link", { name: /SUMMER10/ }),
    ).toBeInTheDocument();
    const urls = requestedUrls();
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0].searchParams.get("active")).toBe("true");
    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows the state pill and the discount text on each row", async () => {
    mockApi([
      promo({
        id: "a",
        code: "SUMMER10",
        discountType: "PERCENT",
        discountValue: "10.00",
        maxRedemptions: 50,
        redemptionCount: 12,
      }),
      promo({
        id: "b",
        code: "EID300",
        discountType: "FLAT",
        discountValue: "300.00",
        maxRedemptions: 4,
        redemptionCount: 4,
      }),
    ]);
    renderPage();

    const summer = await screen.findByRole("link", { name: /SUMMER10/ });
    expect(within(summer).getByText("Active")).toBeInTheDocument();
    expect(within(summer).getByText("10% off")).toBeInTheDocument();
    expect(within(summer).getByText(/Used 12 of 50/)).toBeInTheDocument();
    expect(within(summer).getByText(/No end date/)).toBeInTheDocument();

    const eid = screen.getByRole("link", { name: /EID300/ });
    expect(within(eid).getByText("Used up")).toBeInTheDocument();
    expect(within(eid).getByText("৳300 off")).toBeInTheDocument();
    expect(within(eid).getByText(/Used 4 of 4/)).toBeInTheDocument();
  });

  it("links each row to its detail page", async () => {
    mockApi([promo({ id: "a", code: "SUMMER10" })]);
    renderPage();

    expect(
      await screen.findByRole("link", { name: /SUMMER10/ }),
    ).toHaveAttribute("href", "/dashboard/admin/promo-codes/a");
  });

  it("hides New code from admins who are not super admins", async () => {
    asAdmin(false);
    mockApi([promo({ id: "a" })]);
    renderPage();

    await screen.findByRole("link", { name: /CODEA/ });
    expect(
      screen.queryByRole("button", { name: "New code" }),
    ).not.toBeInTheDocument();
  });

  it("blocks create until the form is valid", async () => {
    mockApi([promo({ id: "a" })]);
    renderPage();
    const user = userEvent.setup();

    const dialog = await openCreateDialog(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Create code" }),
    );

    expect(
      await within(dialog).findByText("Enter a code."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Enter an amount above 0."),
    ).toBeInTheDocument();
    expect(postsToCreate()).toHaveLength(0);
  });

  it("rejects a percent value above 100 and a cap on a taka code", async () => {
    mockApi([promo({ id: "a" })]);
    renderPage();
    const user = userEvent.setup();

    const dialog = await openCreateDialog(user);
    await user.type(within(dialog).getByLabelText("Code"), "summer10");
    await user.type(within(dialog).getByLabelText("Value"), "150");
    await user.click(
      within(dialog).getByRole("button", { name: "Create code" }),
    );

    expect(
      await within(dialog).findByText("A percent discount can be at most 100."),
    ).toBeInTheDocument();
    expect(postsToCreate()).toHaveLength(0);

    // Switching to taka drops the percent limit, and the cap field goes away.
    await user.click(within(dialog).getByLabelText("Taka off"));
    expect(
      within(dialog).queryByLabelText("Max discount (optional)"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText("A percent discount can be at most 100."),
    ).not.toBeInTheDocument();
  });

  it("rejects an end that is not after the start", async () => {
    mockApi([promo({ id: "a" })]);
    renderPage();
    const user = userEvent.setup();

    const dialog = await openCreateDialog(user);
    fireEvent.change(within(dialog).getByLabelText("Starts (optional)"), {
      target: { value: "2030-06-10T10:00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Ends (optional)"), {
      target: { value: "2030-06-09T10:00" },
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Create code" }),
    );

    expect(
      await within(dialog).findByText("Ends must be after the start."),
    ).toBeInTheDocument();
    expect(postsToCreate()).toHaveLength(0);
  });

  it("sends the filled fields in capitals and opens the new code", async () => {
    mockApi([promo({ id: "a" })], () =>
      respond(
        {
          ...promo({ id: "new-1", code: "SUMMER10" }),
          redemptions: [],
        },
        201,
      ),
    );
    renderPage();
    const user = userEvent.setup();

    const dialog = await openCreateDialog(user);
    await user.type(within(dialog).getByLabelText("Code"), "summer10");
    await user.type(within(dialog).getByLabelText("Value"), "10");
    await user.click(
      within(dialog).getByRole("button", { name: "Create code" }),
    );

    await waitFor(() => expect(postsToCreate()).toHaveLength(1));
    const [, init] = postsToCreate()[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      code: "SUMMER10",
      discountType: "PERCENT",
      discountValue: 10,
      maxPerTutor: 1,
    });
    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(
        "/dashboard/admin/promo-codes/new-1",
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Promo code created.");
  });

  it("shows a taken code inline on the Code field", async () => {
    mockApi([promo({ id: "a" })], () =>
      respond(
        {
          code: "PROMO_CODE_EXISTS",
          message: "A promo code with that name already exists.",
        },
        409,
      ),
    );
    renderPage();
    const user = userEvent.setup();

    const dialog = await openCreateDialog(user);
    await user.type(within(dialog).getByLabelText("Code"), "SUMMER10");
    await user.type(within(dialog).getByLabelText("Value"), "10");
    await user.click(
      within(dialog).getByRole("button", { name: "Create code" }),
    );

    expect(
      await within(dialog).findByText(
        "A promo code with that name already exists.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Code")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(nav.push).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
