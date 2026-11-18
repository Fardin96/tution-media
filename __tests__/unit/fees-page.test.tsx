import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeesPage } from "@/components/fees/fees-page";
import { apiFetch } from "@/lib/api";
import type { TutorFee } from "@/lib/fees";

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

function fee(overrides: Partial<TutorFee> = {}): TutorFee {
  return {
    id: "fee-1",
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
    ...overrides,
  };
}

const PAGE_ONE: TutorFee[] = [
  fee({
    id: "fee-1",
    status: "DUE",
    overdue: true,
    application: {
      id: "app-1",
      kind: "REQUIREMENT",
      confirmedAt: "2026-11-10T04:00:00.000Z",
      packageTitle: null,
      studentName: "Nadia Islam",
    },
  }),
  fee({
    id: "fee-2",
    status: "PARTIAL",
    amountPaid: "1000.00",
    remaining: "500.00",
    application: {
      id: "app-2",
      kind: "PACKAGE",
      confirmedAt: "2026-11-11T04:00:00.000Z",
      packageTitle: "SSC Physics crash course",
      studentName: "Tanvir Hasan",
    },
  }),
  fee({
    id: "fee-3",
    status: "DUE",
    unpaid: true,
    overdue: true,
    application: {
      id: "app-3",
      kind: "REQUIREMENT",
      confirmedAt: "2026-10-01T04:00:00.000Z",
      packageTitle: null,
      studentName: "Sumaiya Akter",
    },
  }),
  fee({
    id: "fee-4",
    status: "PAID",
    amountPaid: "1500.00",
    remaining: "0.00",
    application: {
      id: "app-4",
      kind: "REQUIREMENT",
      confirmedAt: "2026-09-01T04:00:00.000Z",
      packageTitle: null,
      studentName: "Rafiq Ahmed",
    },
  }),
];

function mockFees(pages: { fees: TutorFee[]; nextCursor: string | null }[]) {
  vi.mocked(apiFetch).mockImplementation(async (input) => {
    const { pathname, searchParams } = new URL(input, "http://localhost");
    if (pathname !== "/api/v1/fees/mine") return respond({}, 404);
    const index = searchParams.get("cursor") === "page-2" ? 1 : 0;
    return respond(pages[index]);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FeesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FeesPage", () => {
  it("lists each fee with its status, amounts and due date", async () => {
    mockFees([{ fees: PAGE_ONE, nextCursor: null }]);
    renderPage();

    const overdue = await screen.findByRole("link", { name: /Nadia Islam/ });
    expect(overdue).toHaveAttribute("href", "/dashboard/fees/fee-1");
    expect(
      within(overdue).getByText("Tuition requirement"),
    ).toBeInTheDocument();
    expect(within(overdue).getByText("Overdue")).toBeInTheDocument();
    expect(within(overdue).getByText("৳1,500.00")).toBeInTheDocument();
    expect(within(overdue).getByText("Pay")).toBeInTheDocument();
    expect(within(overdue).queryByText("Remaining")).not.toBeInTheDocument();

    const partial = screen.getByRole("link", { name: /Tanvir Hasan/ });
    expect(partial).toHaveAttribute("href", "/dashboard/fees/fee-2");
    expect(
      within(partial).getByText("SSC Physics crash course"),
    ).toBeInTheDocument();
    expect(within(partial).getByText("Partly paid")).toBeInTheDocument();
    expect(within(partial).getByText("Remaining")).toBeInTheDocument();
    expect(within(partial).getByText("৳500.00")).toBeInTheDocument();
    expect(within(partial).getByText("Pay")).toBeInTheDocument();
  });

  it("shows Overdue for a partly paid fee past its due date", async () => {
    mockFees([
      {
        fees: [
          fee({
            id: "fee-5",
            status: "PARTIAL",
            amountPaid: "1000.00",
            remaining: "500.00",
            overdue: true,
            application: {
              id: "app-5",
              kind: "REQUIREMENT",
              confirmedAt: "2026-10-01T04:00:00.000Z",
              packageTitle: null,
              studentName: "Mahbub Alam",
            },
          }),
        ],
        nextCursor: null,
      },
    ]);
    renderPage();

    const late = await screen.findByRole("link", { name: /Mahbub Alam/ });
    expect(within(late).getByText("Overdue")).toBeInTheDocument();
    expect(within(late).queryByText("Partly paid")).not.toBeInTheDocument();
    expect(within(late).getByText("Remaining")).toBeInTheDocument();
  });

  it("shows Unpaid in place of the status when a fee is unpaid", async () => {
    mockFees([{ fees: PAGE_ONE, nextCursor: null }]);
    renderPage();

    const unpaid = await screen.findByRole("link", { name: /Sumaiya Akter/ });
    expect(within(unpaid).getByText("Unpaid")).toBeInTheDocument();
    expect(within(unpaid).queryByText("Overdue")).not.toBeInTheDocument();
  });

  it("shows paid fees without a pay affordance", async () => {
    mockFees([{ fees: PAGE_ONE, nextCursor: null }]);
    renderPage();

    const paid = await screen.findByRole("link", { name: /Rafiq Ahmed/ });
    expect(within(paid).getByText("Paid")).toBeInTheDocument();
    expect(within(paid).queryByText("Pay")).not.toBeInTheDocument();
  });

  it("has one back link to the dashboard", async () => {
    mockFees([{ fees: PAGE_ONE, nextCursor: null }]);
    renderPage();

    await screen.findByRole("link", { name: /Nadia Islam/ });
    expect(screen.getAllByRole("link", { name: "Dashboard" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("shows the empty state when no fees exist yet", async () => {
    mockFees([{ fees: [], nextCursor: null }]);
    renderPage();

    expect(
      await screen.findByText("No placement fees yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You'll see one here after a student confirms you."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("loads the next page when asked", async () => {
    mockFees([
      { fees: PAGE_ONE.slice(0, 1), nextCursor: "page-2" },
      { fees: PAGE_ONE.slice(1), nextCursor: null },
    ]);
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole("link", { name: /Nadia Islam/ });
    expect(
      screen.queryByRole("link", { name: /Tanvir Hasan/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(
      await screen.findByRole("link", { name: /Tanvir Hasan/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("shows an error with a retry when the list fails to load", async () => {
    vi.mocked(apiFetch).mockImplementation(async () =>
      respond({ message: "boom" }, 500),
    );
    renderPage();

    expect(
      await screen.findByText("Couldn't load your placement fees."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
