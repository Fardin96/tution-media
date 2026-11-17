import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { ZoneRequestsPage } from "@/components/admin/zone-requests-page";
import {
  adminZoneRequestApi,
  useAdminZoneRequests,
  type AdminZoneRequest,
} from "@/lib/tutor-zones";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/tutor-zones", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tutor-zones")>();
  return {
    ...actual,
    useAdminZoneRequests: vi.fn(),
    adminZoneRequestApi: { ...actual.adminZoneRequestApi, decide: vi.fn() },
  };
});

function adminRequest(
  overrides: Partial<AdminZoneRequest> & { id: string },
): AdminZoneRequest {
  return {
    requestedLimit: 15,
    reason: "Two new areas near the station",
    status: "PENDING",
    decisionNote: null,
    decidedAt: null,
    createdAt: "2026-11-02T08:00:00.000Z",
    tutor: {
      id: `t-${overrides.id}`,
      name: "Nasrin Akter",
      zoneLimit: 10,
      zonesUsed: 9,
    },
    ...overrides,
  };
}

function mockQueue(
  requests: AdminZoneRequest[] | undefined,
  extra: { isError?: boolean; hasNextPage?: boolean } = {},
) {
  vi.mocked(useAdminZoneRequests).mockReturnValue({
    data:
      requests === undefined
        ? undefined
        : { pages: [{ requests, nextCursor: null }], pageParams: [undefined] },
    isPending: requests === undefined && !extra.isError,
    isError: extra.isError ?? false,
    hasNextPage: extra.hasNextPage ?? false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAdminZoneRequests>);
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ZoneRequestsPage />
    </QueryClientProvider>,
  );
}

describe("ZoneRequestsPage (admin queue)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    vi.mocked(adminZoneRequestApi.decide).mockResolvedValue(
      adminRequest({ id: "x" }),
    );
  });

  it("renders pending rows with tutor, limits and reason", () => {
    mockQueue([
      adminRequest({
        id: "a",
        tutor: { id: "t1", name: "Nasrin Akter", zoneLimit: 10, zonesUsed: 9 },
      }),
      adminRequest({
        id: "b",
        requestedLimit: 22,
        reason: "Expanding to Uttara after the summer",
        tutor: { id: "t2", name: "Rafiq Islam", zoneLimit: 20, zonesUsed: 20 },
      }),
    ]);
    renderPage();
    expect(screen.getByText("Nasrin Akter")).toBeInTheDocument();
    expect(screen.getByText("Rafiq Islam")).toBeInTheDocument();
    expect(screen.getByText("Asks for 22 zones")).toBeInTheDocument();
    expect(
      screen.getByText("Expanding to Uttara after the summer"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(2);
    expect(useAdminZoneRequests).toHaveBeenCalledWith("PENDING");
  });

  it("reads the status tab from the URL", () => {
    nav.search = "status=denied";
    mockQueue([]);
    renderPage();
    expect(useAdminZoneRequests).toHaveBeenCalledWith("DENIED");
  });

  it("approves with the edited limit after confirmation", async () => {
    const user = userEvent.setup();
    mockQueue([adminRequest({ id: "a1", requestedLimit: 15 })]);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByLabelText("Approved limit");
    expect(input).toHaveValue(15);
    await user.clear(input);
    await user.type(input, "20");
    await user.click(
      within(dialog).getByRole("button", { name: "Approve request" }),
    );

    await waitFor(() =>
      expect(adminZoneRequestApi.decide).toHaveBeenCalledWith("a1", {
        decision: "APPROVE",
        approvedLimit: 20,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Request approved");
  });

  it("blocks an approved limit below 6", async () => {
    const user = userEvent.setup();
    mockQueue([adminRequest({ id: "a2", requestedLimit: 15 })]);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByLabelText("Approved limit");
    await user.clear(input);
    await user.type(input, "4");
    await user.click(
      within(dialog).getByRole("button", { name: "Approve request" }),
    );

    expect(
      within(dialog).getByText("Approve at least 6 zones."),
    ).toBeInTheDocument();
    expect(adminZoneRequestApi.decide).not.toHaveBeenCalled();
  });

  it("denies with an optional note", async () => {
    const user = userEvent.setup();
    mockQueue([adminRequest({ id: "d1" })]);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Deny" }));
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(/Note for the tutor/),
      "Please apply again after the audit",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Deny request" }),
    );

    await waitFor(() =>
      expect(adminZoneRequestApi.decide).toHaveBeenCalledWith("d1", {
        decision: "DENY",
        note: "Please apply again after the audit",
      }),
    );
  });

  it("denies without a note when the field is left empty", async () => {
    const user = userEvent.setup();
    mockQueue([adminRequest({ id: "d2" })]);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Deny" }));
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Deny request" }),
    );

    await waitFor(() =>
      expect(adminZoneRequestApi.decide).toHaveBeenCalledWith("d2", {
        decision: "DENY",
      }),
    );
  });

  it("shows the empty state when the queue has no rows", () => {
    mockQueue([]);
    renderPage();
    expect(
      screen.getByText("No pending requests. New requests show up here."),
    ).toBeInTheDocument();
  });

  it("links back to the admin overview", () => {
    mockQueue([]);
    renderPage();
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/dashboard/admin",
    );
  });

  it("shows an error state with a retry button", () => {
    mockQueue(undefined, { isError: true });
    renderPage();
    expect(
      screen.getByText("Couldn't load these requests."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
