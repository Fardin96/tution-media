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
import { AdminPromoCodeDetailPage } from "@/components/admin/promo-code-detail-page";
import { apiFetch } from "@/lib/api";
import { useAdminMe } from "@/lib/admin";
import type {
  AdminPromoCodeDetail,
  AdminPromoRedemption,
} from "@/lib/admin-promo-codes";

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

const PROMO_ID = "promo-1";
const PROMO_PATH = `/api/v1/admin/promo-codes/${PROMO_ID}`;

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function redemption(
  overrides: Partial<AdminPromoRedemption> = {},
): AdminPromoRedemption {
  return {
    id: "r-1",
    feeId: "fee-9",
    tutor: { id: "tutor-1", name: "Nadia Islam" },
    originalAmount: "1500.00",
    discountAmount: "150.00",
    status: "ACTIVE",
    createdAt: "2026-11-10T08:00:00.000Z",
    releasedAt: null,
    releaseReason: null,
    ...overrides,
  };
}

function promo(
  overrides: Partial<AdminPromoCodeDetail> = {},
): AdminPromoCodeDetail {
  return {
    id: PROMO_ID,
    code: "SUMMER10",
    description: "Summer placement offer",
    discountType: "PERCENT",
    discountValue: "10.00",
    maxDiscount: "500.00",
    startsAt: null,
    endsAt: "2030-06-30T12:00:00.000Z",
    maxRedemptions: 50,
    maxPerTutor: 1,
    isActive: true,
    redemptionCount: 1,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    createdByName: "Farabi",
    redemptions: [],
    ...overrides,
  };
}

/** Serves the detail; `patch` answers the PATCH to the same path. */
function mockApi(
  body: AdminPromoCodeDetail,
  patch: (init?: RequestInit) => Response = () => respond(body),
) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    if (init?.method === "PATCH" && pathname === PROMO_PATH) {
      return patch(init);
    }
    if (pathname === PROMO_PATH) return respond(body);
    return respond({ message: "Not mocked" }, 404);
  });
}

function patchesSent() {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(
      ([input, init]) =>
        init?.method === "PATCH" &&
        new URL(input, "http://localhost").pathname === PROMO_PATH,
    );
}

function asAdmin(isSuperAdmin: boolean) {
  vi.mocked(useAdminMe).mockReturnValue({
    isSuperAdmin,
    isSuccess: true,
  } as unknown as ReturnType<typeof useAdminMe>);
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminPromoCodeDetailPage id={PROMO_ID} />
    </QueryClientProvider>,
  );
}

function sectionOf(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: title });
  return heading.closest("section") as HTMLElement;
}

/** The label/value pair in the Details list. */
function detailValue(label: string): HTMLElement {
  const dt = within(sectionOf("Details")).getByText(label, { selector: "dt" });
  const dd = dt.nextElementSibling as HTMLElement;
  return dd;
}

beforeEach(() => {
  vi.clearAllMocks();
  asAdmin(true);
});

describe("AdminPromoCodeDetailPage", () => {
  it("renders the header and the details", async () => {
    mockApi(promo());
    renderPage();

    await screen.findByRole("heading", { name: "Details" });
    expect(
      screen.getByRole("heading", { level: 1, name: "Promo code" }),
    ).toBeInTheDocument();
    expect(screen.getByText("SUMMER10")).toHaveClass("font-mono");
    expect(screen.getByText("10% off (up to ৳500)")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    expect(detailValue("Description")).toHaveTextContent(
      "Summer placement offer",
    );
    expect(detailValue("Starts")).toHaveTextContent("Right away");
    expect(detailValue("Total uses")).toHaveTextContent("50");
    expect(detailValue("Used")).toHaveTextContent("1");
    expect(detailValue("Uses per tutor")).toHaveTextContent("1");
    expect(detailValue("Created by")).toHaveTextContent("Farabi");
  });

  it("shows No limit when the code has no total", async () => {
    mockApi(promo({ maxRedemptions: null, endsAt: null, description: null }));
    renderPage();

    await screen.findByRole("heading", { name: "Details" });
    expect(detailValue("Total uses")).toHaveTextContent("No limit");
    expect(detailValue("Ends")).toHaveTextContent("No end date");
    expect(detailValue("Description")).toHaveTextContent("—");
  });

  it("lists redemptions with their status and fee link", async () => {
    mockApi(
      promo({
        redemptions: [
          redemption(),
          redemption({
            id: "r-2",
            feeId: "fee-10",
            tutor: { id: "tutor-2", name: "Rahim Uddin" },
            status: "RELEASED",
            releaseReason: "Payment was refunded.",
          }),
        ],
      }),
    );
    renderPage();

    const section = await waitFor(() => sectionOf("Redemptions"));
    expect(within(section).getByText("Nadia Islam")).toBeInTheDocument();
    expect(within(section).getByText("In use")).toBeInTheDocument();
    expect(within(section).getByText("Released")).toBeInTheDocument();
    expect(
      within(section).getByText("Payment was refunded."),
    ).toBeInTheDocument();
    expect(
      within(section).getAllByRole("link", { name: "Open fee" })[0],
    ).toHaveAttribute("href", "/dashboard/admin/fees/fee-9");
  });

  it("says nobody has used the code yet when there are no redemptions", async () => {
    mockApi(promo({ redemptions: [], redemptionCount: 0 }));
    renderPage();

    const section = await waitFor(() => sectionOf("Redemptions"));
    expect(
      within(section).getByText("No one has used this code yet."),
    ).toBeInTheDocument();
  });

  it("hides Edit and Turn off from admins who are not super admins", async () => {
    asAdmin(false);
    mockApi(promo());
    renderPage();

    await screen.findByRole("heading", { name: "Details" });
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Turn off" }),
    ).not.toBeInTheDocument();
  });

  it("sends only the changed fields, with endsAt null when Ends is cleared", async () => {
    mockApi(promo(), () => respond(promo({ endsAt: null })));
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Ends"), {
      target: { value: "" },
    });
    await user.click(save);

    await waitFor(() => expect(patchesSent()).toHaveLength(1));
    const [, init] = patchesSent()[0];
    expect(JSON.parse(String(init?.body))).toEqual({ endsAt: null });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Promo code updated."),
    );
  });

  it("clears the total with maxRedemptions null and only sends what changed", async () => {
    mockApi(promo(), () => respond(promo({ maxRedemptions: null })));
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Total uses"), {
      target: { value: "" },
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => expect(patchesSent()).toHaveLength(1));
    const [, init] = patchesSent()[0];
    expect(JSON.parse(String(init?.body))).toEqual({ maxRedemptions: null });
  });

  it("sends a new description without touching the other fields", async () => {
    mockApi(promo(), () => respond(promo({ description: "Eid offer" })));
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        "Discount terms can't change. Create a new code instead.",
      ),
    ).toBeInTheDocument();

    const description = within(dialog).getByLabelText("Description");
    await user.clear(description);
    await user.type(description, "Eid offer");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => expect(patchesSent()).toHaveLength(1));
    const [, init] = patchesSent()[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      description: "Eid offer",
    });
  });

  it("blocks an end date that is not in the future", async () => {
    mockApi(promo());
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Ends"), {
      target: { value: "2020-01-01T10:00" },
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    expect(
      await within(dialog).findByText("Ends must be in the future."),
    ).toBeInTheDocument();
    expect(patchesSent()).toHaveLength(0);
  });

  it("turns the code off with isActive false", async () => {
    mockApi(promo(), () => respond(promo({ isActive: false })));
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Turn off" }));

    await waitFor(() => expect(patchesSent()).toHaveLength(1));
    const [, init] = patchesSent()[0];
    expect(JSON.parse(String(init?.body))).toEqual({ isActive: false });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Code turned off."),
    );
  });

  it("turns a code back on with isActive true", async () => {
    mockApi(promo({ isActive: false }), () =>
      respond(promo({ isActive: true })),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Turn on" }));

    await waitFor(() => expect(patchesSent()).toHaveLength(1));
    const [, init] = patchesSent()[0];
    expect(JSON.parse(String(init?.body))).toEqual({ isActive: true });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Code turned on."),
    );
  });
});
