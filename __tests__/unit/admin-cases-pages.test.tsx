import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminReportsPage } from "@/components/admin/reports-page";
import { AdminReportDetailPage } from "@/components/admin/report-detail-page";
import { AdminDisputesPage } from "@/components/admin/disputes-page";
import { AdminDisputeDetailPage } from "@/components/admin/dispute-detail-page";
import { apiFetch } from "@/lib/api";
import { useAdminMe } from "@/lib/admin";
import type {
  AdminDispute,
  AdminDisputeDetail,
  AdminParty,
  AdminReport,
  AdminReportDetail,
} from "@/lib/admin-cases";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/reports",
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

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

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const reporter: AdminParty = {
  accountId: "acc-rep",
  role: "STUDENT",
  status: "ACTIVE",
  name: "Rafi Hasan",
  email: "rafi@example.com",
};
const target: AdminParty = {
  accountId: "acc-tgt",
  role: "TUTOR",
  status: "BLOCKED",
  name: "Nusrat Jahan",
  email: "nusrat@example.com",
};

function report(overrides: Partial<AdminReport> = {}): AdminReport {
  return {
    id: "rep-1",
    category: "OFF_PLATFORM_CONTACT",
    details: "Asked me to pay by bKash directly.",
    status: "OPEN",
    createdAt: "2026-11-14T08:00:00.000Z",
    resolvedAt: null,
    resolutionNote: null,
    reporter,
    target,
    applicationId: "app-1",
    handledBy: null,
    ...overrides,
  };
}

function reportDetail(
  overrides: Partial<AdminReportDetail> = {},
): AdminReportDetail {
  return {
    ...report(),
    targetOpenReports: 2,
    targetReportCount: 5,
    targetActiveBlock: {
      reason: "Repeated spam",
      blockedAt: "2026-11-10T08:00:00.000Z",
    },
    application: {
      id: "app-1",
      status: "CONFIRMED",
      confirmedAt: "2026-11-12T08:00:00.000Z",
    },
    ...overrides,
  };
}

function dispute(overrides: Partial<AdminDispute> = {}): AdminDispute {
  return {
    id: "dis-1",
    applicationId: "app-1",
    type: "PAYMENT",
    details: "Paid cash, tutor says nothing arrived.",
    status: "OPEN",
    createdAt: "2026-11-14T08:00:00.000Z",
    resolvedAt: null,
    resolutionNote: null,
    raisedBy: reporter,
    against: target,
    handledBy: null,
    ...overrides,
  };
}

function disputeDetail(
  overrides: Partial<AdminDisputeDetail> = {},
): AdminDisputeDetail {
  return {
    ...dispute(),
    application: {
      id: "app-1",
      status: "CONFIRMED",
      confirmedAt: "2026-11-12T08:00:00.000Z",
      endedAt: null,
      tutorId: "t1",
      studentId: "s1",
    },
    otherOpenDisputes: 1,
    ...overrides,
  };
}

function asAdmin(accountId = "acc-admin") {
  vi.mocked(useAdminMe).mockReturnValue({
    adminUser: { accountId },
    isSuperAdmin: false,
    isSuccess: true,
  } as unknown as ReturnType<typeof useAdminMe>);
}

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  );
}

function patches() {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => init?.method === "PATCH");
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  asAdmin();
});

describe("AdminReportsPage", () => {
  function mockList(reports: AdminReport[]) {
    vi.mocked(apiFetch).mockImplementation(async (input) => {
      const url = new URL(input, "http://localhost");
      if (url.pathname === "/api/v1/admin/reports") {
        return respond({ reports, nextCursor: null });
      }
      return respond({ message: "Not mocked" }, 404);
    });
  }

  it("opens on the open queue", async () => {
    mockList([]);
    wrap(<AdminReportsPage />);

    await screen.findByText("No open reports.");
    expect(
      screen.getByRole("button", { name: "Open", pressed: true }),
    ).toBeInTheDocument();
    const [input] = vi.mocked(apiFetch).mock.calls[0];
    expect(new URL(input, "http://localhost").searchParams.get("queue")).toBe(
      "open",
    );
  });

  it("sends the closed queue and category from the URL", async () => {
    nav.search = "queue=closed&category=SPAM";
    mockList([]);
    wrap(<AdminReportsPage />);

    await screen.findByText("No closed reports yet.");
    const [input] = vi.mocked(apiFetch).mock.calls[0];
    const params = new URL(input, "http://localhost").searchParams;
    expect(params.get("queue")).toBe("closed");
    expect(params.get("category")).toBe("SPAM");
  });

  it("lists category, status, parties and handler, linking to the detail", async () => {
    mockList([
      report(),
      report({
        id: "rep-2",
        status: "UNDER_REVIEW",
        handledBy: { accountId: "acc-admin", name: "Sabbir Ahmed" },
      }),
    ]);
    wrap(<AdminReportsPage />);

    await screen.findAllByText("Asked me to pay by bKash directly.", {
      exact: false,
    });
    const links = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("href")?.includes("/reports/"));
    expect(links[0]).toHaveAttribute("href", "/dashboard/admin/reports/rep-1");
    expect(within(links[0]).getByText("Open")).toBeInTheDocument();
    expect(
      within(links[0]).getByText("Contact outside the platform"),
    ).toBeInTheDocument();
    expect(
      within(links[0]).getByText("Rafi Hasan", { exact: false }),
    ).toBeVisible();
    expect(within(links[0]).getByText("No one has taken it")).toBeVisible();
    expect(within(links[1]).getByText("Under review")).toBeVisible();
    expect(within(links[1]).getByText("Handled by Sabbir Ahmed")).toBeVisible();
  });
});

describe("AdminReportDetailPage", () => {
  function mockDetail(
    detail: AdminReportDetail,
    patch: () => Response = () => respond(detail),
  ) {
    vi.mocked(apiFetch).mockImplementation(async (input, init) => {
      const { pathname } = new URL(input, "http://localhost");
      if (init?.method === "PATCH") return patch();
      if (pathname === "/api/v1/admin/reports/rep-1") return respond(detail);
      return respond({ message: "Not mocked" }, 404);
    });
  }

  it("shows the parties, the target summary and the application link", async () => {
    mockDetail(reportDetail());
    wrap(<AdminReportDetailPage id="rep-1" />);

    expect(
      await screen.findByText("Asked me to pay by bKash directly."),
    ).toBeVisible();
    const accountLinks = screen.getAllByRole("link", { name: "Open account" });
    expect(accountLinks.map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard/admin/accounts/acc-rep",
      "/dashboard/admin/accounts/acc-tgt",
    ]);
    expect(screen.getByText(/Repeated spam/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open application" }),
    ).toHaveAttribute("href", "/dashboard/applications/app-1?from=admin");
    expect(screen.getByText(/use the account page/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute(
      "href",
      "/dashboard/admin/reports",
    );
  });

  it("takes the case with ASSIGN and no note", async () => {
    const user = userEvent.setup();
    mockDetail(reportDetail());
    wrap(<AdminReportDetailPage id="rep-1" />);

    await user.click(
      await screen.findByRole("button", { name: "Take this case" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("You took this report."),
    );
    expect(JSON.parse(String(patches()[0][1]?.body))).toEqual({
      action: "ASSIGN",
    });
  });

  it("hides Take this case when the case is already mine", async () => {
    mockDetail(
      reportDetail({
        status: "UNDER_REVIEW",
        handledBy: { accountId: "acc-admin", name: "Me" },
      }),
    );
    wrap(<AdminReportDetailPage id="rep-1" />);

    await screen.findByRole("button", { name: "Resolve" });
    expect(screen.queryByRole("button", { name: "Take this case" })).toBeNull();
  });

  it("needs a note to resolve and sends it trimmed", async () => {
    const user = userEvent.setup();
    mockDetail(reportDetail());
    wrap(<AdminReportDetailPage id="rep-1" />);

    await user.click(await screen.findByRole("button", { name: "Resolve" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Resolve this report?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Resolve report" }),
    );
    expect(
      within(dialog).getByText("Write at least 3 characters."),
    ).toBeVisible();
    expect(patches()).toHaveLength(0);

    await user.type(
      within(dialog).getByLabelText("Note"),
      "  Warned the tutor  ",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Resolve report" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Report resolved."),
    );
    expect(JSON.parse(String(patches()[0][1]?.body))).toEqual({
      action: "RESOLVE",
      note: "Warned the tutor",
    });
  });

  it("shows the outcome and no actions on a closed report", async () => {
    mockDetail(
      reportDetail({
        status: "DISMISSED",
        resolutionNote: "Nothing to act on.",
        resolvedAt: "2026-11-15T08:00:00.000Z",
        handledBy: { accountId: "acc-x", name: "Tania Roy" },
      }),
    );
    wrap(<AdminReportDetailPage id="rep-1" />);

    expect(await screen.findByText("Nothing to act on.")).toBeVisible();
    expect(screen.getAllByText("Tania Roy").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Resolve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });
});

describe("Disputes", () => {
  it("lists disputes with type and raised-by to against", async () => {
    vi.mocked(apiFetch).mockImplementation(async (input) => {
      const url = new URL(input, "http://localhost");
      if (url.pathname === "/api/v1/admin/disputes") {
        return respond({ disputes: [dispute()], nextCursor: null });
      }
      return respond({ message: "Not mocked" }, 404);
    });
    wrap(<AdminDisputesPage />);

    await screen.findByText("Paid cash", { exact: false });
    const link = screen.getByRole("link", { name: /Payment/ });
    expect(link).toHaveAttribute("href", "/dashboard/admin/disputes/dis-1");
    expect(within(link).getByText("Payment")).toBeVisible();
    expect(
      within(link).getByText("Nusrat Jahan", { exact: false }),
    ).toBeVisible();
  });

  it("dismisses a dispute with a note", async () => {
    const user = userEvent.setup();
    const detail = disputeDetail();
    vi.mocked(apiFetch).mockImplementation(async (input, init) => {
      const { pathname } = new URL(input, "http://localhost");
      if (init?.method === "PATCH") return respond(detail);
      if (pathname === "/api/v1/admin/disputes/dis-1") return respond(detail);
      return respond({ message: "Not mocked" }, 404);
    });
    wrap(<AdminDisputeDetailPage id="dis-1" />);

    expect(await screen.findByText("Other open disputes on it")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Dismiss this dispute?",
    });
    await user.type(within(dialog).getByLabelText("Note"), "No evidence");
    await user.click(
      within(dialog).getByRole("button", { name: "Dismiss dispute" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Dispute dismissed."),
    );
    expect(JSON.parse(String(patches()[0][1]?.body))).toEqual({
      action: "DISMISS",
      note: "No evidence",
    });
    // The dialog plays its exit animation before the page behind it is reachable again.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("link", { name: "Disputes" })).toHaveAttribute(
      "href",
      "/dashboard/admin/disputes",
    );
  });
});
