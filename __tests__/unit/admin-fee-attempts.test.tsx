import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminFeeDetailPage } from "@/components/admin/fee-detail-page";
import { apiFetch } from "@/lib/api";
import type { AdminFeeDetail, AdminFeePayment } from "@/lib/admin-fees";
import type { AdminRefund } from "@/lib/admin-refunds";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const FEE_ID = "fee-1";

function respond(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function fee(overrides: Partial<AdminFeeDetail> = {}): AdminFeeDetail {
  return {
    id: FEE_ID,
    feeType: "PLACEMENT",
    status: "DUE",
    amountDue: "1500.00",
    amountPaid: "0.00",
    remaining: "1500.00",
    dueDate: "2026-11-30",
    overdue: false,
    unpaid: true,
    note: null,
    createdAt: "2026-11-10T04:00:00.000Z",
    updatedAt: "2026-11-10T04:00:00.000Z",
    tutor: { id: "tutor-1", name: "Nadia Islam" },
    student: { id: "student-1", name: "Rafiq Ahmed" },
    application: {
      id: "app-1",
      status: "CONFIRMED",
      kind: "REQUIREMENT",
      confirmedAt: "2026-11-10T04:00:00.000Z",
      packageTitle: null,
    },
    payments: [],
    attempts: [],
    promo: null,
    refunds: [],
    ...overrides,
  };
}

function payment(
  overrides: Partial<AdminFeePayment> & { id: string },
): AdminFeePayment {
  return {
    kind: "PAYMENT",
    amount: "1500.00",
    method: "CASH",
    txnReference: null,
    reason: null,
    receivedAt: "2026-11-12T08:00:00.000Z",
    createdAt: "2026-11-12T08:00:00.000Z",
    recordedByName: "Super Admin",
    reversesPaymentId: null,
    reversedAmount: "0.00",
    ...overrides,
  };
}

function refund(overrides: Partial<AdminRefund> & { id: string }): AdminRefund {
  return {
    status: "PROCESSING",
    source: "TUTOR",
    amount: "1500.00",
    reason: "Tuition did not start.",
    refundRefId: "RF-1",
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
      bankTranId: "BANK-1",
    },
    fee: {
      id: FEE_ID,
      status: "PAID",
      amountDue: "1500.00",
      amountPaid: "1500.00",
    },
    tutor: { id: "tutor-1", name: "Nadia Islam" },
    requestedByName: "Nadia Islam",
    decidedByName: null,
    reversalId: null,
    ...overrides,
  };
}

function renderFee(overrides: Partial<AdminFeeDetail>) {
  vi.mocked(apiFetch).mockImplementation(async (input) => {
    const { pathname } = new URL(input, "http://localhost");
    if (pathname === `/api/v1/admin/fees/${FEE_ID}`) {
      return respond(fee(overrides));
    }
    return respond({ message: "Not mocked" });
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminFeeDetailPage id={FEE_ID} />
    </QueryClientProvider>,
  );
}

/** Waits for the fee to load, then returns the card under the heading. */
async function sectionOf(title: string): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { name: title });
  return heading.closest("section") as HTMLElement;
}

describe("AdminFeeDetailPage refunds", () => {
  it("lists the fee's refunds as links to the refund pages", async () => {
    renderFee({
      status: "PAID",
      amountPaid: "1500.00",
      remaining: "0.00",
      refunds: [
        refund({ id: "ref-1", status: "PROCESSING" }),
        refund({
          id: "ref-2",
          status: "SUCCEEDED",
          source: "ADMIN",
          amount: "500.00",
        }),
      ],
    });

    const section = await sectionOf("Refunds");
    const first = await within(section).findByRole("link", {
      name: /1,500 · Tutor asked/,
    });
    expect(first).toHaveAttribute("href", "/dashboard/admin/refunds/ref-1");
    expect(within(first).getByText("Processing")).toBeInTheDocument();

    const second = within(section).getByRole("link", {
      name: /500 · Admin started/,
    });
    expect(second).toHaveAttribute("href", "/dashboard/admin/refunds/ref-2");
    expect(within(second).getByText("Refunded")).toBeInTheDocument();
  });

  it("leaves the Refunds section out when the fee has no refunds", async () => {
    renderFee({});
    await screen.findByRole("heading", { name: "Payments" });
    expect(
      screen.queryByRole("heading", { name: "Refunds" }),
    ).not.toBeInTheDocument();
  });

  it("has no reverse action on an online payment and points to its attempt", async () => {
    renderFee({
      status: "PAID",
      amountPaid: "1500.00",
      remaining: "0.00",
      payments: [
        payment({
          id: "pay-online",
          method: "SSLCOMMERZ",
          txnReference: "TMOK1",
          recordedByName: null,
        }),
        payment({ id: "pay-cash" }),
      ],
      attempts: [
        {
          tranId: "TMOK1",
          status: "SUCCEEDED",
          totalAmount: "1537.50",
          failureReason: null,
          createdAt: "2026-11-12T08:00:00.000Z",
          settledAt: "2026-11-12T08:01:00.000Z",
        },
      ],
    });

    const payments = await sectionOf("Payments");
    await within(payments).findByText(/SSLCommerz \(online\)/);

    // Only the cash payment keeps its reverse action.
    expect(
      within(payments).getAllByRole("button", { name: "Reverse" }),
    ).toHaveLength(1);

    const hint = within(payments).getByRole("link", {
      name: "Refund it from the payment.",
    });
    expect(hint).toHaveAttribute("href", "/dashboard/admin/payments/TMOK1");
  });

  it("shows the refund hint without a link when the attempt is not on the fee", async () => {
    renderFee({
      status: "PAID",
      amountPaid: "1500.00",
      remaining: "0.00",
      payments: [
        payment({
          id: "pay-online",
          method: "SSLCOMMERZ",
          txnReference: "TMGONE",
          recordedByName: null,
        }),
      ],
      attempts: [],
    });

    const payments = await sectionOf("Payments");
    expect(
      await within(payments).findByText("Refund it from the payment."),
    ).toBeInTheDocument();
    expect(
      within(payments).queryByRole("link", {
        name: "Refund it from the payment.",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(payments).queryByRole("button", { name: "Reverse" }),
    ).not.toBeInTheDocument();
  });
});

describe("AdminFeeDetailPage online attempts", () => {
  it("lists each online attempt with a link to its payment page", async () => {
    vi.mocked(apiFetch).mockImplementation(async (input) => {
      const { pathname } = new URL(input, "http://localhost");
      if (pathname === `/api/v1/admin/fees/${FEE_ID}`) {
        return respond(
          fee({
            attempts: [
              {
                tranId: "TM-OK1",
                status: "SUCCEEDED",
                totalAmount: "1537.50",
                failureReason: null,
                createdAt: "2026-11-12T08:00:00.000Z",
                settledAt: "2026-11-12T08:01:00.000Z",
              },
              {
                tranId: "TMFAIL2",
                status: "FAILED",
                totalAmount: "1537.50",
                failureReason: "Card declined by the issuer.",
                createdAt: "2026-11-11T08:00:00.000Z",
                settledAt: null,
              },
            ],
          }),
        );
      }
      return respond({ message: "Not mocked" });
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AdminFeeDetailPage id={FEE_ID} />
      </QueryClientProvider>,
    );

    const heading = await screen.findByRole("heading", {
      name: "Online attempts",
    });
    const section = heading.closest("section") as HTMLElement;

    const paid = within(section).getByRole("link", { name: /TM-OK1/ });
    expect(paid).toHaveAttribute("href", "/dashboard/admin/payments/TM-OK1");
    expect(within(paid).getByText("Paid")).toBeInTheDocument();

    const failed = within(section).getByRole("link", { name: /TMFAIL2/ });
    expect(failed).toHaveAttribute("href", "/dashboard/admin/payments/TMFAIL2");
    expect(
      within(failed).getByText("Card declined by the issuer."),
    ).toBeInTheDocument();
  });
});
