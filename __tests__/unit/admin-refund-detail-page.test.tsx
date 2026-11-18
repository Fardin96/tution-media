import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminRefundDetailPage } from "@/components/admin/refund-detail-page";
import { apiFetch } from "@/lib/api";
import { useAdminMe } from "@/lib/admin";
import type { AdminRefundDetail } from "@/lib/admin-refunds";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  useAdminMe: vi.fn(),
}));

const REFUND_ID = "ref-1";
const REFUND_PATH = `/api/v1/admin/refunds/${REFUND_ID}`;

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function refund(overrides: Partial<AdminRefundDetail> = {}): AdminRefundDetail {
  return {
    id: REFUND_ID,
    status: "REQUESTED",
    source: "TUTOR",
    amount: "1500.00",
    reason: "Tuition did not start.",
    refundRefId: null,
    failureReason: null,
    decisionNote: null,
    createdAt: "2026-11-14T08:00:00.000Z",
    updatedAt: "2026-11-14T08:00:00.000Z",
    decidedAt: null,
    completedAt: null,
    lastCheckedAt: null,
    attempt: {
      tranId: "TMOK1",
      status: "SUCCEEDED",
      feeAmount: "1500.00",
      totalAmount: "1537.50",
      bankTranId: "BANK-7731",
    },
    fee: {
      id: "fee-1",
      status: "PAID",
      amountDue: "1500.00",
      amountPaid: "1500.00",
    },
    tutor: { id: "tutor-1", name: "Nadia Islam" },
    requestedByName: "Nadia Islam",
    decidedByName: null,
    reversalId: null,
    gatewayResponse: { status: "SUCCESS" },
    canApprove: false,
    canReject: false,
    canCheck: false,
    canResolve: false,
    ...overrides,
  };
}

/** Serves the refund; `post` answers the POSTs (approve, reject, check, resolve). */
function mockApi(
  body: AdminRefundDetail,
  post: (pathname: string, init?: RequestInit) => Response = () =>
    respond(body),
) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    if (init?.method === "POST") return post(pathname, init);
    if (pathname === REFUND_PATH) return respond(body);
    return respond({ message: "Not mocked" }, 404);
  });
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
      <AdminRefundDetailPage id={REFUND_ID} />
    </QueryClientProvider>,
  );
}

function sectionOf(title: string): HTMLElement {
  return screen
    .getByRole("heading", { name: title })
    .closest("section") as HTMLElement;
}

function postsTo(suffix: string) {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(
      ([input, init]) =>
        init?.method === "POST" &&
        new URL(input, "http://localhost").pathname.endsWith(suffix),
    );
}

beforeEach(() => {
  vi.clearAllMocks();
  asAdmin(false);
});

describe("AdminRefundDetailPage actions", () => {
  it("shows Approve and Decline only to super admins when the server allows them", async () => {
    asAdmin(true);
    mockApi(refund({ canApprove: true, canReject: true }));
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Approve" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resolve" }),
    ).not.toBeInTheDocument();
  });

  it("hides the decision buttons from admins who are not super admins", async () => {
    asAdmin(false);
    mockApi(refund({ canApprove: true, canReject: true, canCheck: true }));
    renderPage();

    expect(
      await screen.findByText("A super admin decides refunds."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Decline" }),
    ).not.toBeInTheDocument();
    // Check with gateway is open to every admin.
    expect(
      screen.getByRole("button", { name: "Check with gateway" }),
    ).toBeEnabled();
  });

  it("shows Resolve only to super admins when the refund needs review", async () => {
    asAdmin(true);
    mockApi(refund({ status: "NEEDS_REVIEW", canResolve: true }));
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Resolve" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });

  it("hides Check with gateway when the server does not allow it", async () => {
    mockApi(refund({ status: "SUCCEEDED", canCheck: false }));
    renderPage();

    await screen.findByRole("heading", { level: 2, name: "Refund" });
    expect(
      screen.queryByRole("button", { name: "Check with gateway" }),
    ).not.toBeInTheDocument();
  });

  it("declines only with a note of at least 3 characters", async () => {
    asAdmin(true);
    mockApi(refund({ canReject: true }), () =>
      respond(refund({ status: "REJECTED", canReject: false })),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Decline" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Decline refund" }),
    );

    expect(
      await within(dialog).findByText("Write at least 3 characters."),
    ).toBeInTheDocument();
    expect(postsTo("/reject")).toHaveLength(0);

    await user.type(within(dialog).getByLabelText("Note"), "Tutor was paid");
    await user.click(
      within(dialog).getByRole("button", { name: "Decline refund" }),
    );

    await waitFor(() => expect(postsTo("/reject")).toHaveLength(1));
    const [, init] = postsTo("/reject")[0];
    expect(JSON.parse(String(init?.body))).toEqual({ note: "Tutor was paid" });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Refund declined."),
    );
  });

  it("approves without a note and warns when the gateway does not answer clearly", async () => {
    asAdmin(true);
    mockApi(refund({ canApprove: true }), () =>
      respond(refund({ status: "NEEDS_REVIEW", canResolve: true })),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        "This sends the refund to SSLCommerz now. The processing charge isn't refunded.",
      ),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Approve refund" }),
    );

    await waitFor(() => expect(postsTo("/approve")).toHaveLength(1));
    const [, init] = postsTo("/approve")[0];
    expect(JSON.parse(String(init?.body))).toEqual({});
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        "The gateway didn't answer clearly. Check the merchant panel.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("resolves a successful refund with its gateway reference and note", async () => {
    asAdmin(true);
    mockApi(refund({ status: "NEEDS_REVIEW", canResolve: true }), () =>
      respond(
        refund({
          status: "SUCCEEDED",
          completedAt: "2026-11-18T08:00:00.000Z",
        }),
      ),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Resolve" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByLabelText("The money was refunded"));
    await user.type(
      within(dialog).getByLabelText("Gateway refund reference (optional)"),
      "  RF-OK-9  ",
    );
    await user.type(
      within(dialog).getByLabelText("Note"),
      "Matched in the merchant panel",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Resolve refund" }),
    );

    await waitFor(() => expect(postsTo("/resolve")).toHaveLength(1));
    const [, init] = postsTo("/resolve")[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      outcome: "SUCCEEDED",
      note: "Matched in the merchant panel",
      refundRefId: "RF-OK-9",
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Refund resolved."),
    );
  });

  it("resolves a refund that never happened without a gateway reference", async () => {
    asAdmin(true);
    mockApi(refund({ status: "NEEDS_REVIEW", canResolve: true }), () =>
      respond(refund({ status: "FAILED", failureReason: "Not sent." })),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Resolve" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByLabelText("No refund happened"));
    expect(
      within(dialog).queryByLabelText("Gateway refund reference (optional)"),
    ).not.toBeInTheDocument();
    await user.type(
      within(dialog).getByLabelText("Note"),
      "Merchant panel shows nothing",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Resolve refund" }),
    );

    await waitFor(() => expect(postsTo("/resolve")).toHaveLength(1));
    const [, init] = postsTo("/resolve")[0];
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      outcome: "FAILED",
      note: "Merchant panel shows nothing",
    });
    expect(body).not.toHaveProperty("refundRefId");
  });

  it("asks for an outcome before resolving", async () => {
    asAdmin(true);
    mockApi(refund({ status: "NEEDS_REVIEW", canResolve: true }));
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Resolve" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Note"), "Checked it");
    await user.click(
      within(dialog).getByRole("button", { name: "Resolve refund" }),
    );

    expect(
      await within(dialog).findByText("Choose what happened at the gateway."),
    ).toBeInTheDocument();
    expect(postsTo("/resolve")).toHaveLength(0);
  });
});

describe("AdminRefundDetailPage details", () => {
  it("explains that the fee is due again after a refund that reversed a payment", async () => {
    mockApi(
      refund({
        status: "SUCCEEDED",
        completedAt: "2026-11-18T08:00:00.000Z",
        reversalId: "pay-rev-1",
      }),
    );
    renderPage();

    expect(
      await screen.findByText(
        "The fee is due again. Waive it from the fee page if the tutor shouldn't pay.",
      ),
    ).toBeInTheDocument();
  });

  it("does not show the reversal hint when no reversal was written", async () => {
    mockApi(refund({ status: "SUCCEEDED", reversalId: null }));
    renderPage();

    await screen.findByRole("heading", { level: 2, name: "Refund" });
    expect(
      screen.queryByText(
        "The fee is due again. Waive it from the fee page if the tutor shouldn't pay.",
      ),
    ).not.toBeInTheDocument();
  });

  it("links the payment and the fee", async () => {
    mockApi(refund());
    renderPage();

    const payment = await screen.findByRole("link", { name: "TMOK1" });
    expect(payment).toHaveAttribute("href", "/dashboard/admin/payments/TMOK1");
    const fee = within(sectionOf("Fee")).getByRole("link", {
      name: "Open fee",
    });
    expect(fee).toHaveAttribute("href", "/dashboard/admin/fees/fee-1");
  });

  it("keeps the raw gateway response collapsed", async () => {
    mockApi(refund());
    const { container } = renderPage();
    await screen.findByRole("heading", { level: 2, name: "Refund" });

    const raw = container.querySelector("details");
    expect(raw).not.toBeNull();
    expect(raw).not.toHaveAttribute("open");
    expect(raw?.querySelector("pre")?.textContent).toContain('"SUCCESS"');
  });
});
