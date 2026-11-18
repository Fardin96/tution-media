import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminFeeDetailPage } from "@/components/admin/fee-detail-page";
import { apiFetch } from "@/lib/api";
import type { AdminFeeDetail } from "@/lib/admin-fees";

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
    ...overrides,
  };
}

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
