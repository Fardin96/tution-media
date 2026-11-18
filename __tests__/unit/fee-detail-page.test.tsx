import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { FeeDetailPage } from "@/components/fees/fee-detail-page";
import { apiFetch } from "@/lib/api";
import type { CheckoutQuote, TutorFeeDetail } from "@/lib/fees";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const FEE_ID = "fee-1";
const GATEWAY_URL = "https://sandbox.sslcommerz.com/gw/TM-ABC123";

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function enabledQuote(overrides: Partial<CheckoutQuote> = {}): CheckoutQuote {
  return {
    enabled: true,
    unavailableReason: null,
    feeAmount: "1500.00",
    chargePercent: "2.50",
    chargeAmount: "37.50",
    totalAmount: "1537.50",
    ...overrides,
  };
}

function detail(overrides: Partial<TutorFeeDetail> = {}): TutorFeeDetail {
  return {
    id: FEE_ID,
    feeType: "PLACEMENT",
    status: "DUE",
    amountDue: "1500.00",
    amountPaid: "0.00",
    remaining: "1500.00",
    dueDate: "2026-11-30",
    overdue: false,
    unpaid: false,
    createdAt: "2026-11-10T04:00:00.000Z",
    application: {
      id: "app-1",
      kind: "REQUIREMENT",
      confirmedAt: "2026-11-10T04:00:00.000Z",
      packageTitle: null,
      studentName: "Nadia Islam",
    },
    payments: [],
    checkout: enabledQuote(),
    pendingAttempt: null,
    ...overrides,
  };
}

const SESSION = {
  tranId: "TM-ABC123",
  gatewayUrl: GATEWAY_URL,
  feeAmount: "1500.00",
  chargeAmount: "37.50",
  totalAmount: "1537.50",
};

/** Serves the fee detail and answers the checkout POST with `checkout`. */
function mockApi(
  body: TutorFeeDetail,
  checkout: () => Promise<Response> = async () => respond(SESSION, 201),
) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    if (pathname === `/api/v1/fees/${FEE_ID}`) return respond(body);
    if (
      pathname === `/api/v1/fees/${FEE_ID}/checkout` &&
      init?.method === "POST"
    ) {
      return checkout();
    }
    return respond({ message: "Not mocked" }, 404);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FeeDetailPage feeId={FEE_ID} />
    </QueryClientProvider>,
  );
}

const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FeeDetailPage pay online", () => {
  it("shows the breakdown and a pay button with the total", async () => {
    mockApi(detail());
    renderPage();

    const pay = await screen.findByRole("region", { name: "Pay online" });
    expect(within(pay).getByText("Placement fee")).toBeInTheDocument();
    expect(within(pay).getByText("৳1,500.00")).toBeInTheDocument();
    expect(
      within(pay).getByText("Processing charge (2.5%)"),
    ).toBeInTheDocument();
    expect(within(pay).getByText("৳37.50")).toBeInTheDocument();
    expect(within(pay).getByText("Total")).toBeInTheDocument();
    expect(within(pay).getByText("৳1,537.50")).toBeInTheDocument();
    expect(
      within(pay).getByRole("button", {
        name: "Pay ৳1,537.50 with SSLCommerz",
      }),
    ).toBeEnabled();
    expect(
      within(pay).getByText(
        "You'll finish on SSLCommerz's secure page and come back here. The processing charge covers the gateway's fee and isn't refunded.",
      ),
    ).toBeInTheDocument();
  });

  it("skips the processing charge row when it is zero", async () => {
    mockApi(
      detail({
        checkout: enabledQuote({
          chargePercent: "0.00",
          chargeAmount: "0.00",
          totalAmount: "1500.00",
        }),
      }),
    );
    renderPage();

    const pay = await screen.findByRole("region", { name: "Pay online" });
    expect(
      within(pay).queryByText(/Processing charge/),
    ).not.toBeInTheDocument();
    expect(
      within(pay).getByRole("button", {
        name: "Pay ৳1,500.00 with SSLCommerz",
      }),
    ).toBeInTheDocument();
  });

  it("starts checkout and sends the browser to the gateway", async () => {
    mockApi(detail());
    renderPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: "Pay ৳1,537.50 with SSLCommerz",
      }),
    );

    await waitFor(() => expect(assign).toHaveBeenCalledWith(GATEWAY_URL));
    const post = vi
      .mocked(apiFetch)
      .mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeDefined();
    expect(new URL(post![0], "http://localhost").pathname).toBe(
      `/api/v1/fees/${FEE_ID}/checkout`,
    );
  });

  it("shows Opening SSLCommerz and disables the button while the session starts", async () => {
    let release!: (res: Response) => void;
    mockApi(detail(), () => new Promise<Response>((res) => (release = res)));
    renderPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: "Pay ৳1,537.50 with SSLCommerz",
      }),
    );

    const busy = await screen.findByRole("button", {
      name: "Opening SSLCommerz…",
    });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");

    release(respond(SESSION, 201));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(GATEWAY_URL));
  });

  it("shows the gateway error as a toast", async () => {
    mockApi(detail(), async () =>
      respond({ code: "GATEWAY_UNAVAILABLE", message: "Gateway down" }, 503),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: "Pay ৳1,537.50 with SSLCommerz",
      }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "The payment gateway isn't responding. Try again in a few minutes.",
      ),
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("explains that online payment is turned off, with no button", async () => {
    mockApi(
      detail({
        checkout: enabledQuote({
          enabled: false,
          unavailableReason: "PAYMENTS_OFF",
        }),
      }),
    );
    renderPage();

    const pay = await screen.findByRole("region", { name: "Pay online" });
    expect(
      within(pay).getByText(
        "Online payment is turned off right now. You can still pay the Tuition Media team in cash.",
      ),
    ).toBeInTheDocument();
    expect(
      within(pay).queryByRole("button", { name: /SSLCommerz/ }),
    ).not.toBeInTheDocument();
  });

  it("explains the minimum amount for online payment, with no button", async () => {
    mockApi(
      detail({
        checkout: enabledQuote({
          enabled: false,
          unavailableReason: "BELOW_MINIMUM",
          feeAmount: "5.00",
          chargePercent: "2.50",
          chargeAmount: "0.13",
          totalAmount: "5.13",
        }),
      }),
    );
    renderPage();

    const pay = await screen.findByRole("region", { name: "Pay online" });
    expect(
      within(pay).getByText(
        "Online payments start at ৳10. Pay the rest in cash.",
      ),
    ).toBeInTheDocument();
    expect(
      within(pay).queryByRole("button", { name: /SSLCommerz/ }),
    ).not.toBeInTheDocument();
  });

  it("notes a payment that is still open and links to check it", async () => {
    mockApi(
      detail({
        pendingAttempt: {
          tranId: "TM-ABC123",
          createdAt: "2026-11-18T04:00:00.000Z",
        },
      }),
    );
    renderPage();

    const pay = await screen.findByRole("region", { name: "Pay online" });
    expect(
      within(pay).getByText(/A payment you started at .+ is still open/),
    ).toBeInTheDocument();
    expect(
      within(pay).getByRole("link", { name: "Check that payment" }),
    ).toHaveAttribute(
      "href",
      `/dashboard/fees/${FEE_ID}/payment?tran=TM-ABC123`,
    );
    // The server replaces a stale checkout, so the pay button stays usable.
    expect(
      within(pay).getByRole("button", {
        name: "Pay ৳1,537.50 with SSLCommerz",
      }),
    ).toBeEnabled();
  });

  it("hides the pay section when there is no checkout quote", async () => {
    mockApi(detail({ checkout: null, status: "PAID", remaining: "0.00" }));
    renderPage();

    expect(
      await screen.findByRole("region", { name: "Summary" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Pay online" }),
    ).not.toBeInTheDocument();
  });
});

describe("FeeDetailPage payments", () => {
  it("shows a reversal as a negative amount", async () => {
    mockApi(
      detail({
        payments: [
          {
            id: "p1",
            kind: "PAYMENT",
            amount: "1500.00",
            method: "SSLCOMMERZ",
            receivedAt: "2026-11-12T04:00:00.000Z",
            reversesPaymentId: null,
          },
          {
            id: "p2",
            kind: "REVERSAL",
            amount: "500.00",
            method: "CASH",
            receivedAt: "2026-11-13T04:00:00.000Z",
            reversesPaymentId: "p1",
          },
        ],
      }),
    );
    renderPage();

    const ledger = await screen.findByRole("region", { name: "Payments" });
    expect(within(ledger).getByText("Online (SSLCommerz)")).toBeInTheDocument();
    expect(within(ledger).getByText("৳1,500.00")).toBeInTheDocument();
    expect(within(ledger).getByText("Reversed")).toBeInTheDocument();
    expect(within(ledger).getByText("−৳500.00")).toBeInTheDocument();
  });

  it("says so when there are no payments", async () => {
    mockApi(detail());
    renderPage();

    const ledger = await screen.findByRole("region", { name: "Payments" });
    expect(within(ledger).getByText("No payments yet.")).toBeInTheDocument();
  });
});

describe("FeeDetailPage states", () => {
  it("has one back link to the fee list", async () => {
    mockApi(detail());
    renderPage();

    await screen.findByRole("region", { name: "Summary" });
    const back = screen.getAllByRole("link", { name: "Fees" });
    expect(back).toHaveLength(1);
    expect(back[0]).toHaveAttribute("href", "/dashboard/fees");
  });

  it("links to the application the fee belongs to", async () => {
    mockApi(detail());
    renderPage();

    const summary = await screen.findByRole("region", { name: "Summary" });
    expect(
      within(summary).getByRole("link", { name: "View application" }),
    ).toHaveAttribute("href", "/dashboard/applications/app-1");
  });

  it("says when the fee cannot be found", async () => {
    vi.mocked(apiFetch).mockImplementation(async () =>
      respond({ message: "Not found" }, 404),
    );
    renderPage();

    expect(
      await screen.findByText("We couldn't find that fee."),
    ).toBeInTheDocument();
  });
});
