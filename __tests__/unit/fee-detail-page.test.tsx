import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { FeeDetailPage } from "@/components/fees/fee-detail-page";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/admin";
import type {
  CheckoutQuote,
  TutorFeeDetail,
  TutorFeePayment,
  TutorRefund,
} from "@/lib/fees";

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
    promo: null,
    promoAllowed: true,
    refunds: [],
    heldPayments: [],
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

/**
 * Serves the fee detail, answers the checkout POST with `checkout`, and answers the promo
 * POST and DELETE with `promo`.
 */
function mockApi(
  body: TutorFeeDetail,
  checkout: () => Promise<Response> = async () => respond(SESSION, 201),
  promo: () => Promise<Response> = async () => respond(body),
  refund: () => Promise<Response> = async () => respond(body, 201),
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
    if (pathname === `/api/v1/fees/${FEE_ID}/promo`) return promo();
    if (pathname === `/api/v1/fees/${FEE_ID}/refunds`) return refund();
    return respond({ message: "Not mocked" }, 404);
  });
}

const APPLIED = {
  code: "SAVE20",
  discountAmount: "300.00",
  originalAmount: "1500.00",
  appliedAt: "2026-11-18T04:00:00.000Z",
};

/** A fee with SAVE20 applied: the amount due is already reduced. */
function discounted(overrides: Partial<TutorFeeDetail> = {}): TutorFeeDetail {
  return detail({
    amountDue: "1200.00",
    remaining: "1200.00",
    checkout: enabledQuote({
      feeAmount: "1200.00",
      chargePercent: "2.50",
      chargeAmount: "30.00",
      totalAmount: "1230.00",
    }),
    promo: APPLIED,
    promoAllowed: false,
    ...overrides,
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

describe("FeeDetailPage payments on hold", () => {
  it("lists a payment being checked and pauses online payment", async () => {
    mockApi(
      detail({
        heldPayments: [
          {
            tranId: "TM-REVIEW1",
            status: "REVIEW",
            feeAmount: "1500.00",
            totalAmount: "1537.50",
            createdAt: "2026-11-18T04:00:00.000Z",
          },
        ],
        checkout: enabledQuote({
          enabled: false,
          unavailableReason: "IN_REVIEW",
        }),
        promoAllowed: false,
      }),
    );
    renderPage();

    const held = await screen.findByRole("region", {
      name: "Payments on hold",
    });
    expect(within(held).getByText("৳1,537.50")).toBeInTheDocument();
    expect(within(held).getByText("Being checked")).toBeInTheDocument();
    expect(within(held).getByText(/so don't pay again/)).toBeInTheDocument();
    expect(
      within(held).getByRole("link", { name: "See this payment" }),
    ).toHaveAttribute(
      "href",
      `/dashboard/fees/${FEE_ID}/payment?tran=TM-REVIEW1`,
    );

    const pay = screen.getByRole("region", { name: "Pay online" });
    expect(
      within(pay).getByText(/paused while we check your earlier payment/),
    ).toBeInTheDocument();
    expect(within(pay).queryByRole("button")).not.toBeInTheDocument();
  });

  it("says an unapplied payment will be refunded, fee part only", async () => {
    mockApi(
      detail({
        status: "WAIVED",
        checkout: null,
        promoAllowed: false,
        heldPayments: [
          {
            tranId: "TM-UNAPPLIED1",
            status: "UNAPPLIED",
            feeAmount: "1500.00",
            totalAmount: "1537.50",
            createdAt: "2026-11-18T04:00:00.000Z",
          },
        ],
      }),
    );
    renderPage();

    const held = await screen.findByRole("region", {
      name: "Payments on hold",
    });
    expect(within(held).getByText("To be refunded")).toBeInTheDocument();
    expect(
      within(held).getByText(/We'll refund the fee part \(৳1,500\.00\)/),
    ).toBeInTheDocument();
  });

  it("hides the section when nothing is on hold", async () => {
    mockApi(detail());
    renderPage();

    await screen.findByRole("region", { name: "Summary" });
    expect(
      screen.queryByRole("region", { name: "Payments on hold" }),
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
            refundableUntil: null,
          },
          {
            id: "p2",
            kind: "REVERSAL",
            amount: "500.00",
            method: "CASH",
            receivedAt: "2026-11-13T04:00:00.000Z",
            reversesPaymentId: "p1",
            refundableUntil: null,
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

describe("FeeDetailPage promo code", () => {
  it("shows the promo form only when a code can still be applied", async () => {
    mockApi(detail({ promoAllowed: true }));
    const { unmount } = renderPage();

    const section = await screen.findByRole("region", { name: "Promo code" });
    expect(
      within(section).getByRole("textbox", { name: "Promo code" }),
    ).toHaveAttribute("maxLength", "32");
    expect(
      within(section).getByRole("button", { name: "Apply" }),
    ).toBeEnabled();
    unmount();

    mockApi(detail({ promoAllowed: false, promo: null }));
    renderPage();

    await screen.findByRole("region", { name: "Summary" });
    expect(
      screen.queryByRole("region", { name: "Promo code" }),
    ).not.toBeInTheDocument();
  });

  it("asks for a code without sending a request when the field is empty", async () => {
    mockApi(detail());
    renderPage();
    const user = userEvent.setup();

    const section = await screen.findByRole("region", { name: "Promo code" });
    await user.click(within(section).getByRole("button", { name: "Apply" }));

    const input = within(section).getByRole("textbox", { name: "Promo code" });
    expect(within(section).getByText("Enter a code.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a code.");
    expect(
      vi
        .mocked(apiFetch)
        .mock.calls.some(([url]) => String(url).includes("/promo")),
    ).toBe(false);
  });

  it("applies the trimmed code and toasts", async () => {
    mockApi(detail(), undefined, async () => respond(discounted()));
    renderPage();
    const user = userEvent.setup();

    const section = await screen.findByRole("region", { name: "Promo code" });
    await user.type(
      within(section).getByRole("textbox", { name: "Promo code" }),
      "  SAVE20  ",
    );
    await user.click(within(section).getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Code applied."),
    );
    const post = vi
      .mocked(apiFetch)
      .mock.calls.find(([url]) => String(url).includes("/promo"));
    expect(post).toBeDefined();
    expect(new URL(post![0], "http://localhost").pathname).toBe(
      `/api/v1/fees/${FEE_ID}/promo`,
    );
    expect(post![1]?.method).toBe("POST");
    expect(JSON.parse(post![1]!.body as string)).toEqual({ code: "SAVE20" });
    // The returned fee replaces the form with the applied code.
    expect(
      await screen.findByRole("button", { name: "Remove code" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Promo code" })).toBeNull();
  });

  it("says nothing is left to pay when the code waives the fee", async () => {
    mockApi(detail(), undefined, async () =>
      respond(
        discounted({
          status: "WAIVED",
          amountDue: "0.00",
          remaining: "0.00",
          checkout: null,
          promo: {
            ...APPLIED,
            discountAmount: "1500.00",
            originalAmount: "1500.00",
          },
        }),
      ),
    );
    renderPage();
    const user = userEvent.setup();

    const section = await screen.findByRole("region", { name: "Promo code" });
    await user.type(
      within(section).getByRole("textbox", { name: "Promo code" }),
      "SAVE20",
    );
    await user.click(within(section).getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Code applied. Nothing left to pay.",
      ),
    );
  });

  it("shows a refused code inline under the field, not as a toast", async () => {
    mockApi(detail(), undefined, async () =>
      respond({ code: "PROMO_INVALID", message: "This code has ended." }, 409),
    );
    renderPage();
    const user = userEvent.setup();

    const section = await screen.findByRole("region", { name: "Promo code" });
    const input = within(section).getByRole("textbox", { name: "Promo code" });
    await user.type(input, "SAVE20");
    await user.click(within(section).getByRole("button", { name: "Apply" }));

    expect(
      await within(section).findByText("This code has ended."),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("This code has ended.");
    expect(toast.error).not.toHaveBeenCalled();
    expect(input).toHaveValue("SAVE20");
  });

  it("shows the applied code with a remove button while nothing is paid", async () => {
    mockApi(discounted());
    renderPage();

    const section = await screen.findByRole("region", { name: "Promo code" });
    // The code is in its own span, so match the paragraph's full text.
    expect(
      within(section).getByText(
        (_, el) =>
          el?.tagName === "P" && el.textContent === "SAVE20 takes ৳300.00 off.",
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole("button", { name: "Remove code" }),
    ).toBeEnabled();
    expect(
      within(section).queryByRole("textbox", { name: "Promo code" }),
    ).not.toBeInTheDocument();
  });

  it("hides the removable code once a payment has been made", async () => {
    mockApi(discounted({ amountPaid: "500.00", remaining: "730.00" }));
    renderPage();

    await screen.findByRole("region", { name: "Summary" });
    expect(
      screen.queryByRole("region", { name: "Promo code" }),
    ).not.toBeInTheDocument();
  });

  it("removes the code with DELETE and toasts", async () => {
    mockApi(discounted(), undefined, async () =>
      respond(detail({ promo: null, promoAllowed: true })),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "Remove code" }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Code removed."),
    );
    const del = vi
      .mocked(apiFetch)
      .mock.calls.find(([url]) => String(url).includes("/promo"));
    expect(del![1]?.method).toBe("DELETE");
    expect(
      await screen.findByRole("textbox", { name: "Promo code" }),
    ).toBeInTheDocument();
  });

  it("lists the original amount and the discount above the amount due", async () => {
    mockApi(discounted());
    renderPage();

    const summary = await screen.findByRole("region", { name: "Summary" });
    expect(within(summary).getByText("৳1,500.00")).toBeInTheDocument();
    expect(within(summary).getByText("−৳300.00")).toBeInTheDocument();
    const labels = within(summary)
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(labels.slice(0, 3)).toEqual([
      "Original amount",
      "Promo SAVE20",
      "Amount due",
    ]);
  });

  it("says the promo code covered a waived fee", async () => {
    mockApi(
      discounted({
        status: "WAIVED",
        amountDue: "0.00",
        remaining: "0.00",
        checkout: null,
        promo: {
          ...APPLIED,
          discountAmount: "1500.00",
          originalAmount: "1500.00",
        },
      }),
    );
    renderPage();

    const summary = await screen.findByRole("region", { name: "Summary" });
    expect(
      within(summary).getByText("Your promo code covered this fee."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Promo code" }),
    ).not.toBeInTheDocument();
  });
});

describe("FeeDetailPage waived fees", () => {
  /** The value shown next to a summary label, e.g. "৳0.00". */
  function summaryValue(summary: HTMLElement, label: string) {
    return within(summary).getByText(label, { selector: "dt" })
      .nextElementSibling?.textContent;
  }

  it("shows nothing due for a fee a promo code waived in full", async () => {
    mockApi(
      detail({
        status: "WAIVED",
        amountDue: "1500.00",
        amountPaid: "0.00",
        remaining: "1500.00",
        checkout: null,
        promoAllowed: false,
        promo: {
          code: "FREE100",
          discountAmount: "1500.00",
          originalAmount: "1500.00",
          appliedAt: "2026-11-18T04:00:00.000Z",
        },
      }),
    );
    renderPage();

    const summary = await screen.findByRole("region", { name: "Summary" });
    expect(summaryValue(summary, "Amount due")).toBe("৳0.00");
    expect(summaryValue(summary, "Remaining")).toBe("৳0.00");
    expect(within(summary).getByText("Promo FREE100")).toBeInTheDocument();
    expect(within(summary).getByText("−৳1,500.00")).toBeInTheDocument();
    expect(summaryValue(summary, "Original amount")).toBe("৳1,500.00");
  });

  it("shows nothing remaining on a waived fee with no promo, and keeps the amount due", async () => {
    mockApi(
      detail({
        status: "WAIVED",
        amountDue: "1500.00",
        amountPaid: "0.00",
        remaining: "1500.00",
        checkout: null,
        promoAllowed: true,
        promo: null,
      }),
    );
    renderPage();

    const summary = await screen.findByRole("region", { name: "Summary" });
    expect(summaryValue(summary, "Amount due")).toBe("৳1,500.00");
    expect(summaryValue(summary, "Remaining")).toBe("৳0.00");
  });
});

const REFUNDABLE_UNTIL = "2026-11-19T04:00:00.000Z";

function payment(overrides: Partial<TutorFeePayment> = {}): TutorFeePayment {
  return {
    id: "p1",
    kind: "PAYMENT",
    amount: "1500.00",
    method: "SSLCOMMERZ",
    receivedAt: "2026-11-12T04:00:00.000Z",
    reversesPaymentId: null,
    refundableUntil: REFUNDABLE_UNTIL,
    ...overrides,
  };
}

function refund(overrides: Partial<TutorRefund> = {}): TutorRefund {
  return {
    id: "r1",
    paymentId: "p1",
    amount: "1500.00",
    status: "REQUESTED",
    reason: "Wrong class booked",
    createdAt: "2026-11-13T04:00:00.000Z",
    completedAt: null,
    decisionNote: null,
    ...overrides,
  };
}

/** Every request the page sent to the refunds endpoint. */
function refundRequests() {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(([url]) => String(url).includes("/refunds"));
}

async function openRefundDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: "Request a refund" }),
  );
  return screen.findByRole("dialog", { name: "Ask for a refund?" });
}

describe("FeeDetailPage refund request", () => {
  it("offers a refund only for payments that are inside the refund window", async () => {
    mockApi(
      detail({
        payments: [
          payment(),
          payment({
            id: "p2",
            method: "CASH",
            amount: "200.00",
            refundableUntil: null,
          }),
        ],
      }),
    );
    renderPage();

    const ledger = await screen.findByRole("region", { name: "Payments" });
    expect(
      within(ledger).getAllByRole("button", { name: "Request a refund" }),
    ).toHaveLength(1);
  });

  it("says what is refunded and the last day to ask", async () => {
    mockApi(detail({ payments: [payment()] }));
    renderPage();
    const user = userEvent.setup();

    const dialog = await openRefundDialog(user);
    expect(
      within(dialog).getByText(
        `We refund the fee part (৳1,500.00). The processing charge isn't refunded. You can ask until ${formatDateTime(REFUNDABLE_UNTIL)}.`,
      ),
    ).toBeInTheDocument();
  });

  it("does not send an empty or too-short reason", async () => {
    mockApi(detail({ payments: [payment()] }));
    renderPage();
    const user = userEvent.setup();

    const dialog = await openRefundDialog(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Send request" }),
    );

    const reason = within(dialog).getByRole("textbox", { name: "Reason" });
    expect(
      within(dialog).getByText("Write at least 3 characters."),
    ).toBeInTheDocument();
    expect(reason).toHaveAccessibleDescription("Write at least 3 characters.");
    expect(refundRequests()).toHaveLength(0);

    await user.type(reason, "ab");
    await user.click(
      within(dialog).getByRole("button", { name: "Send request" }),
    );
    expect(
      within(dialog).getByText("Write at least 3 characters."),
    ).toBeInTheDocument();
    expect(refundRequests()).toHaveLength(0);
  });

  it("posts the payment and the trimmed reason, then closes and toasts", async () => {
    mockApi(detail({ payments: [payment()] }));
    renderPage();
    const user = userEvent.setup();

    const dialog = await openRefundDialog(user);
    await user.type(
      within(dialog).getByRole("textbox", { name: "Reason" }),
      "  Booked the wrong class  ",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Send request" }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Refund requested."),
    );
    const [url, init] = refundRequests()[0];
    expect(new URL(url, "http://localhost").pathname).toBe(
      `/api/v1/fees/${FEE_ID}/refunds`,
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual({
      paymentId: "p1",
      reason: "Booked the wrong class",
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Ask for a refund?" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps the dialog open and shows a refused request inline", async () => {
    mockApi(detail({ payments: [payment()] }), undefined, undefined, async () =>
      respond(
        {
          code: "REFUND_NOT_ALLOWED",
          message: "A refund for this payment is already open.",
        },
        409,
      ),
    );
    renderPage();
    const user = userEvent.setup();

    const dialog = await openRefundDialog(user);
    await user.type(
      within(dialog).getByRole("textbox", { name: "Reason" }),
      "Booked the wrong class",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Send request" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "A refund for this payment is already open.",
    );
    expect(
      screen.getByRole("dialog", { name: "Ask for a refund?" }),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("FeeDetailPage refunds", () => {
  it("lists refunds with tutor labels, dates and the decision note", async () => {
    mockApi(
      detail({
        refunds: [
          refund({ id: "r1", status: "NEEDS_REVIEW" }),
          refund({
            id: "r2",
            status: "REJECTED",
            reason: "Asked after the lesson",
            completedAt: "2026-11-16T04:00:00.000Z",
            decisionNote: "The class ran as booked.",
          }),
        ],
      }),
    );
    renderPage();

    const section = await screen.findByRole("region", { name: "Refunds" });
    expect(within(section).getByText("In progress")).toBeInTheDocument();
    expect(within(section).getByText("Declined")).toBeInTheDocument();
    expect(
      within(section).getByText("Asked after the lesson"),
    ).toBeInTheDocument();
    expect(
      within(section).getByText("The class ran as booked."),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(
        `Asked on ${formatDateTime("2026-11-13T04:00:00.000Z")} · Done on ${formatDateTime("2026-11-16T04:00:00.000Z")}`,
      ),
    ).toBeInTheDocument();
  });

  it("hides the section when there are no refunds", async () => {
    mockApi(detail({ payments: [payment({ refundableUntil: null })] }));
    renderPage();

    await screen.findByRole("region", { name: "Payments" });
    expect(
      screen.queryByRole("region", { name: "Refunds" }),
    ).not.toBeInTheDocument();
  });
});
