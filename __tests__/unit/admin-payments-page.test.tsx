import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminPaymentsPage } from "@/components/admin/payments-page";
import { apiFetch } from "@/lib/api";
import type {
  AdminPaymentAttempt,
  AdminPaymentSummary,
} from "@/lib/admin-payments";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/payments",
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

function attempt(
  overrides: Partial<AdminPaymentAttempt> & { id: string },
): AdminPaymentAttempt {
  return {
    tranId: `TR${overrides.id.toUpperCase()}`,
    status: "REVIEW",
    feeAmount: "1500.00",
    chargeAmount: "15.00",
    totalAmount: "1515.00",
    failureReason: null,
    valId: null,
    bankTranId: null,
    cardType: null,
    riskLevel: null,
    paymentId: null,
    createdAt: "2026-11-17T04:00:00.000Z",
    updatedAt: "2026-11-17T04:05:00.000Z",
    lastCheckedAt: null,
    settledAt: null,
    fee: {
      id: "fee-1",
      status: "DUE",
      amountDue: "1500.00",
      amountPaid: "0.00",
    },
    tutor: { id: "tutor-1", name: "Nasrin Akter" },
    ...overrides,
  };
}

const SUMMARY: AdminPaymentSummary = {
  review: 3,
  unapplied: 0,
  stalePending: 2,
  succeeded24h: 12,
  collected24h: "4500.00",
};

/** Routes the two admin payment endpoints. `summary` may be a Response or a promise. */
function mockApi(options: {
  attempts?: AdminPaymentAttempt[];
  nextCursor?: string | null;
  summary?: Response | Promise<Response>;
}) {
  vi.mocked(apiFetch).mockImplementation(async (input) => {
    const { pathname } = new URL(input, "http://localhost");
    if (pathname === "/api/v1/admin/payment-attempts/summary") {
      return options.summary ?? respond(SUMMARY);
    }
    if (pathname === "/api/v1/admin/payment-attempts") {
      return respond({
        attempts: options.attempts ?? [],
        nextCursor: options.nextCursor ?? null,
      });
    }
    return respond({}, 404);
  });
}

function requestedUrls(): URL[] {
  return vi
    .mocked(apiFetch)
    .mock.calls.map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/v1/admin/payment-attempts");
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminPaymentsPage />
    </QueryClientProvider>,
  );
}

/** The summary tile for a label. Scoped to the summary list, since the filter chips reuse some labels. */
function tile(label: string) {
  const list = screen.getByRole("list", { name: "Payment summary" });
  const item = within(list).getByText(label).closest("li");
  if (!item) throw new Error(`No summary tile for ${label}`);
  return item;
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
});

describe("AdminPaymentsPage", () => {
  it("shows the attention view by default and requests attention=true", async () => {
    mockApi({
      attempts: [
        attempt({ id: "a", tutor: { id: "t1", name: "Nasrin Akter" } }),
      ],
    });
    renderPage();

    expect(
      await screen.findByRole("link", { name: /Nasrin Akter/ }),
    ).toBeInTheDocument();
    const urls = requestedUrls();
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0].searchParams.get("attention")).toBe("true");
    expect(urls[0].searchParams.get("status")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Needs attention" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("switches views and writes the view to the URL", async () => {
    mockApi({ attempts: [] });
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(nav.replace).toHaveBeenLastCalledWith(
      "/dashboard/admin/payments?view=all",
      { scroll: false },
    );

    await user.click(screen.getByRole("button", { name: "Not applied" }));
    expect(nav.replace).toHaveBeenLastCalledWith(
      "/dashboard/admin/payments?view=unapplied",
      { scroll: false },
    );
  });

  it("drops the view param when the default view is chosen again", async () => {
    nav.search = "view=all";
    mockApi({ attempts: [] });
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Needs attention" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/dashboard/admin/payments", {
      scroll: false,
    });
  });

  it("requests the status named in the URL", async () => {
    nav.search = "view=review";
    mockApi({ attempts: [] });
    renderPage();

    await waitFor(() => expect(requestedUrls().length).toBeGreaterThan(0));
    const url = requestedUrls()[0];
    expect(url.searchParams.get("status")).toBe("REVIEW");
    expect(url.searchParams.get("attention")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Needs review" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("links each row to its payment detail", async () => {
    mockApi({
      attempts: [
        attempt({
          id: "a",
          tranId: "TR20261117A",
          tutor: { id: "t1", name: "Nasrin Akter" },
          totalAmount: "1515.00",
          feeAmount: "1500.00",
          settledAt: "2026-11-17T04:10:00.000Z",
          failureReason: "Amount mismatch with the gateway record.",
        }),
      ],
    });
    renderPage();

    const row = await screen.findByRole("link", { name: /Nasrin Akter/ });
    expect(row).toHaveAttribute(
      "href",
      "/dashboard/admin/payments/TR20261117A",
    );
    expect(within(row).getByText("TR20261117A")).toBeInTheDocument();
    expect(within(row).getByText("Needs review")).toBeInTheDocument();
    expect(within(row).getByText("৳1,515")).toBeInTheDocument();
    expect(within(row).getByText("৳1,500")).toBeInTheDocument();
    expect(within(row).getByText("Total")).toBeInTheDocument();
    expect(within(row).getByText("Fee part")).toBeInTheDocument();
    expect(within(row).getByText("Started")).toBeInTheDocument();
    expect(within(row).getByText("Settled")).toBeInTheDocument();
    expect(
      within(row).getByText("Amount mismatch with the gateway record."),
    ).toBeInTheDocument();
  });

  it("leaves out Settled and the failure text when they are empty", async () => {
    mockApi({
      attempts: [
        attempt({ id: "b", tutor: { id: "t2", name: "Rafiq Islam" } }),
      ],
    });
    renderPage();

    const row = await screen.findByRole("link", { name: /Rafiq Islam/ });
    expect(within(row).queryByText("Settled")).not.toBeInTheDocument();
    expect(within(row).queryByText(/Amount mismatch/)).not.toBeInTheDocument();
  });

  it("renders the summary numbers, with the collected amount under the paid count", async () => {
    mockApi({ attempts: [] });
    renderPage();

    await waitFor(() => expect(tile("Needs review")).toHaveTextContent("3"));
    expect(tile("Not applied")).toHaveTextContent("0");
    expect(tile("Stuck over an hour")).toHaveTextContent("2");
    expect(tile("Paid in the last 24 h")).toHaveTextContent("12");
    expect(tile("Paid in the last 24 h")).toHaveTextContent("৳4,500 collected");
  });

  it("accents only the attention tiles that have a count", async () => {
    mockApi({ attempts: [] });
    renderPage();

    await waitFor(() => expect(tile("Needs review")).toHaveTextContent("3"));
    expect(tile("Needs review").className).toContain(
      "semantic-warning-surface",
    );
    expect(tile("Not applied").className).not.toContain(
      "semantic-error-surface",
    );
    expect(tile("Stuck over an hour").className).not.toContain(
      "semantic-warning-surface",
    );
  });

  it("shows dashes in the summary while it loads", async () => {
    mockApi({ attempts: [], summary: new Promise(() => {}) });
    renderPage();

    expect(
      await screen.findByRole("list", { name: "Payment summary" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(tile("Needs review")).toHaveTextContent("–");
    expect(tile("Paid in the last 24 h")).toHaveTextContent("–");
  });

  it("hides the summary strip when it fails, and keeps the list", async () => {
    mockApi({
      attempts: [
        attempt({ id: "c", tutor: { id: "t3", name: "Sumaiya Akter" } }),
      ],
      summary: respond({ message: "boom" }, 500),
    });
    renderPage();

    expect(
      await screen.findByRole("link", { name: /Sumaiya Akter/ }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("list", { name: "Payment summary" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("explains the attention view when nothing needs a decision", async () => {
    mockApi({ attempts: [] });
    renderPage();

    expect(
      await screen.findByText(
        "Nothing needs a decision. Flagged and unapplied payments show up here.",
      ),
    ).toBeInTheDocument();
  });

  it("explains the all view when there are no payments", async () => {
    nav.search = "view=all";
    mockApi({ attempts: [] });
    renderPage();

    expect(
      await screen.findByText("No online payments yet."),
    ).toBeInTheDocument();
  });

  it("uses the generic empty text for the other views", async () => {
    nav.search = "view=expired";
    mockApi({ attempts: [] });
    renderPage();

    expect(
      await screen.findByText("No payments in this view."),
    ).toBeInTheDocument();
  });

  it("has one back link to the admin overview", async () => {
    mockApi({ attempts: [] });
    renderPage();

    await screen.findByText(
      "Nothing needs a decision. Flagged and unapplied payments show up here.",
    );
    expect(screen.getAllByRole("link", { name: "Admin" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/dashboard/admin",
    );
  });
});
