import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminPaymentDetailPage } from "@/components/admin/payment-detail-page";
import { apiFetch } from "@/lib/api";
import { useAdminMe } from "@/lib/admin";
import type { AdminPaymentAttemptDetail } from "@/lib/admin-payments";

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

const TRAN_ID = "TM-ABC123";
const ATTEMPT_PATH = `/api/v1/admin/payment-attempts/${TRAN_ID}`;

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function attempt(
  overrides: Partial<AdminPaymentAttemptDetail> = {},
): AdminPaymentAttemptDetail {
  return {
    id: "att-1",
    tranId: TRAN_ID,
    status: "PENDING",
    feeAmount: "1500.00",
    chargeAmount: "37.50",
    totalAmount: "1537.50",
    failureReason: null,
    valId: "VAL-9981",
    bankTranId: "BANK-7731",
    cardType: "VISA-Dutch Bangla",
    riskLevel: 0,
    paymentId: null,
    createdAt: "2026-11-17T10:00:00.000Z",
    updatedAt: "2026-11-17T10:05:00.000Z",
    lastCheckedAt: null,
    settledAt: null,
    fee: {
      id: "fee-1",
      status: "DUE",
      amountDue: "1500.00",
      amountPaid: "0.00",
    },
    tutor: { id: "tutor-1", name: "Nadia Islam" },
    gatewayResponse: { status: "VALID", tran_id: TRAN_ID },
    canCheck: true,
    canReview: false,
    ...overrides,
  };
}

/** Serves the attempt detail; `post` answers the check and review POSTs. */
function mockApi(
  body: AdminPaymentAttemptDetail,
  post: (pathname: string, init?: RequestInit) => Response = () =>
    respond(body),
) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    if (init?.method === "POST") return post(pathname, init);
    if (pathname === ATTEMPT_PATH) return respond(body);
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
      <AdminPaymentDetailPage tranId={TRAN_ID} />
    </QueryClientProvider>,
  );
}

function sectionOf(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: title });
  return heading.closest("section") as HTMLElement;
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

describe("AdminPaymentDetailPage", () => {
  it("renders the amounts, the fee and the gateway fields", async () => {
    mockApi(attempt());
    renderPage();

    await screen.findByRole("heading", { name: "Amounts" });
    expect(
      screen.getByRole("heading", { level: 1, name: "Online payment" }),
    ).toBeInTheDocument();
    expect(screen.getByText(TRAN_ID)).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();

    const amounts = sectionOf("Amounts");
    // formatAmount drops trailing zeros, as the rest of the admin area does.
    expect(within(amounts).getByText("৳1,537.5")).toBeInTheDocument();
    expect(within(amounts).getByText("৳1,500")).toBeInTheDocument();
    expect(within(amounts).getByText("৳37.5")).toBeInTheDocument();

    const fee = sectionOf("Fee");
    expect(within(fee).getByText("Nadia Islam")).toBeInTheDocument();
    expect(within(fee).getByRole("link", { name: "Open fee" })).toHaveAttribute(
      "href",
      "/dashboard/admin/fees/fee-1",
    );

    const gateway = sectionOf("Gateway");
    expect(within(gateway).getByText("BANK-7731")).toBeInTheDocument();
    expect(within(gateway).getByText("VISA-Dutch Bangla")).toBeInTheDocument();
    expect(within(gateway).getByText("VAL-9981")).toBeInTheDocument();
    expect(within(gateway).getByText("Low")).toBeInTheDocument();
    expect(within(gateway).getByText("Never")).toBeInTheDocument();
  });

  it("shows the failure reason as a callout above the sections", async () => {
    mockApi(
      attempt({
        status: "FAILED",
        failureReason: "Card declined by the issuer.",
      }),
    );
    renderPage();

    const reason = await screen.findByText("Card declined by the issuer.");
    expect(reason.compareDocumentPosition(sectionOf("Amounts"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("shows the check button only when the server allows it", async () => {
    mockApi(attempt({ canCheck: false }));
    const { unmount } = renderPage();
    await screen.findByRole("heading", { name: "Amounts" });
    expect(
      screen.queryByRole("button", { name: "Check with gateway" }),
    ).not.toBeInTheDocument();
    unmount();

    mockApi(attempt({ canCheck: true }));
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Check with gateway" }),
    ).toBeEnabled();
  });

  it("checks with the gateway and reports the new status", async () => {
    mockApi(attempt(), (pathname) => {
      expect(pathname).toBe(`${ATTEMPT_PATH}/check`);
      return respond(attempt({ status: "SUCCEEDED", canCheck: false }));
    });
    renderPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "Check with gateway" }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Payment is now Paid."),
    );
  });

  it("shows Approve and Reject only to super admins on a payment in review", async () => {
    asAdmin(true);
    mockApi(attempt({ status: "REVIEW", canReview: true }));
    const { unmount } = renderPage();
    expect(
      await screen.findByRole("button", { name: "Approve" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    unmount();

    asAdmin(false);
    mockApi(attempt({ status: "REVIEW", canReview: true }));
    const second = renderPage();
    expect(
      await screen.findByText("A super admin decides flagged payments."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reject" }),
    ).not.toBeInTheDocument();
    second.unmount();

    asAdmin(true);
    mockApi(
      attempt({ status: "SUCCEEDED", canReview: false, canCheck: false }),
    );
    renderPage();
    await screen.findByRole("heading", { name: "Amounts" });
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });

  it("blocks submit until the note has at least 3 characters", async () => {
    asAdmin(true);
    mockApi(attempt({ status: "REVIEW", canReview: true }));
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Approve payment" }),
    );

    expect(
      await within(dialog).findByText(
        "Write a note with at least 3 characters.",
      ),
    ).toBeInTheDocument();
    expect(postsTo("/review")).toHaveLength(0);
  });

  it("sends the decision and the trimmed note to the review API", async () => {
    asAdmin(true);
    mockApi(attempt({ status: "REVIEW", canReview: true }), () =>
      respond(attempt({ status: "SUCCEEDED", canReview: false })),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Note"),
      "  Matched in the merchant panel  ",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Approve payment" }),
    );

    await waitFor(() => expect(postsTo("/review")).toHaveLength(1));
    const [, init] = postsTo("/review")[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      decision: "APPROVE",
      note: "Matched in the merchant panel",
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Payment approved."),
    );
  });

  it("keeps the raw gateway response collapsed", async () => {
    mockApi(attempt());
    const { container } = renderPage();
    await screen.findByRole("heading", { name: "Amounts" });

    const raw = container.querySelector("details");
    expect(raw).not.toBeNull();
    expect(raw).not.toHaveAttribute("open");
    expect(raw?.querySelector("pre")?.textContent).toContain(
      '"status": "VALID"',
    );
  });
});
