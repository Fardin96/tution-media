import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { ReportDialog } from "@/components/cases/report-dialog";
import { DisputeDialog } from "@/components/cases/dispute-dialog";
import { ApplicationCaseActions } from "@/components/cases/application-case-actions";
import { apiFetch } from "@/lib/api";
import type { ApplicationDetail } from "@/lib/applications";
import type { MyDispute } from "@/lib/cases";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
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

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const DETAILS = "He did not turn up on Saturday or Sunday.";

function posts(path: string) {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(
      ([url, init]) => String(url).includes(path) && init?.method === "POST",
    );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(toast.success).mockClear();
});
afterEach(() => vi.clearAllMocks());

describe("ReportDialog", () => {
  function open(onOpenChange = vi.fn()) {
    wrap(
      <ReportDialog
        applicationId="app-1"
        targetName="Rahim Uddin"
        open
        onOpenChange={onOpenChange}
      />,
    );
    return onOpenChange;
  }

  it("sends the category and details with the application id", async () => {
    vi.mocked(apiFetch).mockResolvedValue(respond({ id: "r1" }, 201));
    const onOpenChange = open();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /Spam/ }));
    await user.type(screen.getByLabelText("Details"), DETAILS);
    await user.click(screen.getByRole("button", { name: "Send report" }));

    await waitFor(() => expect(posts("/api/v1/reports")).toHaveLength(1));
    const body = JSON.parse(String(posts("/api/v1/reports")[0][1]?.body));
    expect(body).toEqual({
      applicationId: "app-1",
      category: "SPAM",
      details: DETAILS,
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Report sent"),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows inline errors and sends nothing when empty", async () => {
    open();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByText("Pick what the problem is.")).toBeInTheDocument();
    expect(
      screen.getByText("Write at least 10 characters."),
    ).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("locks the details and categories while the report is sending", async () => {
    vi.mocked(apiFetch).mockReturnValue(new Promise(() => {}));
    open();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /Spam/ }));
    await user.type(screen.getByLabelText("Details"), DETAILS);
    await user.click(screen.getByRole("button", { name: "Send report" }));

    const send = await screen.findByRole("button", { name: "Send report" });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Details")).toBeDisabled();
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) expect(radio).toBeDisabled();
  });

  it("shows a 409 inline and keeps the dialog open", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      respond({ code: "REPORT_EXISTS", message: "dup" }, 409),
    );
    const onOpenChange = open();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /Spam/ }));
    await user.type(screen.getByLabelText("Details"), DETAILS);
    await user.click(screen.getByRole("button", { name: "Send report" }));

    const alert = await screen.findByText(
      "You already have an open report about this account.",
    );
    expect(alert).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("DisputeDialog", () => {
  it("sends the type and details", async () => {
    vi.mocked(apiFetch).mockResolvedValue(respond({ id: "d1" }, 201));
    const onOpenChange = vi.fn();
    wrap(
      <DisputeDialog applicationId="app-1" open onOpenChange={onOpenChange} />,
    );
    const user = userEvent.setup();
    expect(
      screen.getByText(
        /A problem with this tuition that you want us to step in on/,
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Payment/ }));
    await user.type(screen.getByLabelText("Details"), DETAILS);
    await user.click(screen.getByRole("button", { name: "Open dispute" }));

    await waitFor(() => expect(posts("/api/v1/disputes")).toHaveLength(1));
    expect(JSON.parse(String(posts("/api/v1/disputes")[0][1]?.body))).toEqual({
      applicationId: "app-1",
      type: "PAYMENT",
      details: DETAILS,
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Dispute opened"),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

function application(status: ApplicationDetail["status"]): ApplicationDetail {
  return {
    id: "app-1",
    status,
    tutor: { id: "t1", name: "Rahim Uddin" },
    student: { id: "s1", name: "Nadia Islam" },
  } as unknown as ApplicationDetail;
}

function dispute(status: MyDispute["status"]): MyDispute {
  return {
    id: "d1",
    applicationId: "app-1",
    type: "PAYMENT",
    details: DETAILS,
    status,
    createdAt: "2026-11-10T04:00:00.000Z",
    resolvedAt: null,
    resolutionNote: null,
    against: { accountId: "a1", role: "TUTOR", name: "Rahim Uddin" },
  };
}

function serveDisputes(disputes: MyDispute[]) {
  vi.mocked(apiFetch).mockImplementation(async () =>
    respond({ disputes, nextCursor: null }),
  );
}

describe("ApplicationCaseActions", () => {
  it("offers a dispute and a report on a confirmed application", async () => {
    serveDisputes([]);
    wrap(
      <ApplicationCaseActions
        application={application("CONFIRMED")}
        viewerRole="STUDENT"
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Open a dispute" }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByRole("button", { name: "Report Rahim Uddin" }),
    ).toBeInTheDocument();
  });

  it("names the student for a tutor", async () => {
    serveDisputes([]);
    wrap(
      <ApplicationCaseActions
        application={application("COMPLETED")}
        viewerRole="TUTOR"
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Report Nadia Islam" }),
    ).toBeInTheDocument();
  });

  it("hides the whole card on a pending application and skips the fetch", () => {
    wrap(
      <ApplicationCaseActions
        application={application("PENDING")}
        viewerRole="STUDENT"
      />,
    );
    expect(screen.queryByRole("button", { name: "Open a dispute" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Report Rahim Uddin" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Something wrong?" }),
    ).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it.each(["WITHDRAWN", "EXPIRED"] as const)(
    "hides the report on a %s application",
    (status) => {
      const { container } = wrap(
        <ApplicationCaseActions
          application={application(status)}
          viewerRole="TUTOR"
        />,
      );
      expect(
        screen.queryByRole("button", { name: "Report Nadia Islam" }),
      ).toBeNull();
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("shows the status of an open dispute instead of the button", async () => {
    serveDisputes([dispute("UNDER_REVIEW")]);
    wrap(
      <ApplicationCaseActions
        application={application("CONFIRMED")}
        viewerRole="STUDENT"
      />,
    );
    const link = await screen.findByRole("link", { name: /Dispute: Payment/ });
    expect(within(link).getByText("Being looked at")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open a dispute" })).toBeNull();
  });

  it("allows a new dispute once the last one is closed", async () => {
    serveDisputes([dispute("RESOLVED")]);
    wrap(
      <ApplicationCaseActions
        application={application("COMPLETED")}
        viewerRole="STUDENT"
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Open a dispute" }),
    ).toBeInTheDocument();
  });
});
