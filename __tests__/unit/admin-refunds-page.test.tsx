import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminRefundsPage } from "@/components/admin/refunds-page";
import { apiFetch } from "@/lib/api";
import type { AdminRefund } from "@/lib/admin-refunds";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/refunds",
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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
      id: "fee-1",
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

/** Serves the refund list; every request's query string is kept for assertions. */
function mockApi(refunds: AdminRefund[]) {
  vi.mocked(apiFetch).mockImplementation(async (input) => {
    const url = new URL(input, "http://localhost");
    if (url.pathname === "/api/v1/admin/refunds") {
      return respond({ refunds, nextCursor: null });
    }
    return respond({ message: "Not mocked" }, 404);
  });
}

function requestedQueries(): URLSearchParams[] {
  return vi
    .mocked(apiFetch)
    .mock.calls.map(
      ([input]) => new URL(input, "http://localhost").searchParams,
    );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminRefundsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
});

describe("AdminRefundsPage", () => {
  it("opens on the in-progress view and asks the API for open refunds", async () => {
    mockApi([]);
    renderPage();

    await screen.findByText("No refunds in progress.");
    const queries = requestedQueries();
    expect(queries.length).toBeGreaterThan(0);
    expect(queries[0].get("open")).toBe("true");
    expect(queries[0].get("status")).toBeNull();
  });

  it("asks for one status when a status view is chosen", async () => {
    nav.search = "view=FAILED";
    mockApi([]);
    renderPage();

    await screen.findByText("No refunds in this view.");
    const queries = requestedQueries();
    expect(queries[0].get("status")).toBe("FAILED");
    expect(queries[0].get("open")).toBeNull();
  });

  it("lists each refund with its tutor, amount, status, source and transaction", async () => {
    mockApi([
      refund({
        id: "ref-1",
        status: "NEEDS_REVIEW",
        failureReason: "Gateway timed out.",
      }),
      refund({
        id: "ref-2",
        status: "SUCCEEDED",
        source: "ADMIN",
        amount: "750.00",
        tutor: { id: "tutor-2", name: "Rafiq Ahmed" },
        attempt: {
          tranId: "TMSECOND",
          status: "SUCCEEDED",
          feeAmount: "750.00",
          totalAmount: "786.00",
          bankTranId: null,
        },
      }),
    ]);
    renderPage();

    const first = await screen.findByRole("link", { name: /Nadia Islam/ });
    expect(first).toHaveAttribute("href", "/dashboard/admin/refunds/ref-1");
    expect(within(first).getByText("Needs review")).toBeInTheDocument();
    expect(within(first).getByText("৳1,500")).toBeInTheDocument();
    expect(within(first).getByText("Tutor asked")).toBeInTheDocument();
    expect(within(first).getByText("TMOK1")).toBeInTheDocument();
    expect(within(first).getByText("Gateway timed out.")).toBeInTheDocument();

    const second = screen.getByRole("link", { name: /Rafiq Ahmed/ });
    expect(second).toHaveAttribute("href", "/dashboard/admin/refunds/ref-2");
    expect(within(second).getByText("Refunded")).toBeInTheDocument();
    expect(within(second).getByText("৳750")).toBeInTheDocument();
    expect(within(second).getByText("Admin started")).toBeInTheDocument();
    expect(within(second).getByText("TMSECOND")).toBeInTheDocument();
  });

  it("shows the empty text for each view", async () => {
    const cases: [string, string][] = [
      ["", "No refunds in progress."],
      ["view=all", "No refunds yet."],
      ["view=REJECTED", "No refunds in this view."],
    ];
    for (const [search, text] of cases) {
      nav.search = search;
      mockApi([]);
      const { unmount } = renderPage();
      expect(await screen.findByText(text)).toBeInTheDocument();
      unmount();
    }
  });

  it("marks the chosen view as pressed", async () => {
    nav.search = "view=SUCCEEDED";
    mockApi([]);
    renderPage();

    const group = await screen.findByRole("group", { name: "Refund view" });
    expect(
      within(group).getByRole("button", { name: "Refunded" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(group).getByRole("button", { name: "In progress" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
