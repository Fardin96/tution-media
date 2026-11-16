import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { ZoneLimitRequestDialog } from "@/components/tutor-zones/zone-limit-request-dialog";
import {
  tutorZoneApi,
  useZoneLimitRequests,
  type ZoneLimitRequest,
} from "@/lib/tutor-zones";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/tutor-zones", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tutor-zones")>();
  return {
    ...actual,
    useZoneLimitRequests: vi.fn(),
    tutorZoneApi: { ...actual.tutorZoneApi, requestMore: vi.fn() },
  };
});

function request(
  overrides: Partial<ZoneLimitRequest> & { id: string },
): ZoneLimitRequest {
  return {
    requestedLimit: 12,
    reason: "Covering two new areas",
    status: "PENDING",
    decisionNote: null,
    decidedAt: null,
    createdAt: "2026-11-01T08:00:00.000Z",
    ...overrides,
  };
}

function mockHistory(
  requests: ZoneLimitRequest[] = [],
  extra: { hasNextPage?: boolean } = {},
) {
  vi.mocked(useZoneLimitRequests).mockReturnValue({
    data: requests.length
      ? { pages: [{ requests, nextCursor: null }], pageParams: [undefined] }
      : undefined,
    isPending: false,
    isError: false,
    hasNextPage: extra.hasNextPage ?? false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useZoneLimitRequests>);
}

function renderDialog(
  props: Partial<Parameters<typeof ZoneLimitRequestDialog>[0]> = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ZoneLimitRequestDialog
        open
        onOpenChange={onOpenChange}
        currentLimit={10}
        pendingRequest={null}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe("ZoneLimitRequestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHistory();
  });

  it("starts at five more zones and shows a live character count", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.getByLabelText("How many zones do you need?")).toHaveValue(
      15,
    );
    await user.type(screen.getByLabelText("Why do you need them?"), "Hello");
    expect(screen.getByText("5/500")).toBeInTheDocument();
  });

  it("rejects a limit that is not above the current limit", async () => {
    const user = userEvent.setup();
    renderDialog();
    const input = screen.getByLabelText("How many zones do you need?");
    await user.clear(input);
    await user.type(input, "10");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(
      screen.getByText("Pick a number above your current limit of 10."),
    ).toBeInTheDocument();
    expect(tutorZoneApi.requestMore).not.toHaveBeenCalled();
  });

  it("rejects a limit above the maximum of 50", async () => {
    const user = userEvent.setup();
    renderDialog();
    const input = screen.getByLabelText("How many zones do you need?");
    await user.clear(input);
    await user.type(input, "51");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(
      screen.getByText("The most zones you can have is 50."),
    ).toBeInTheDocument();
    expect(tutorZoneApi.requestMore).not.toHaveBeenCalled();
  });

  it("rejects a reason shorter than 10 characters", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(
      screen.getByLabelText("Why do you need them?"),
      "too short",
    );
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(
      screen.getByText(
        "Explain why you need more zones. Use at least 10 characters.",
      ),
    ).toBeInTheDocument();
    expect(tutorZoneApi.requestMore).not.toHaveBeenCalled();
  });

  it("sends the trimmed reason and the chosen limit, then closes", async () => {
    const user = userEvent.setup();
    vi.mocked(tutorZoneApi.requestMore).mockResolvedValue(
      request({ id: "r1" }),
    );
    const { onOpenChange } = renderDialog();

    const input = screen.getByLabelText("How many zones do you need?");
    await user.clear(input);
    await user.type(input, "14");
    await user.type(
      screen.getByLabelText("Why do you need them?"),
      "  Two new areas near the station  ",
    );
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() =>
      expect(tutorZoneApi.requestMore).toHaveBeenCalledWith({
        requestedLimit: 14,
        reason: "Two new areas near the station",
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toast.success).toHaveBeenCalledWith("Request sent");
  });

  it("hides the form and shows the pending request", () => {
    renderDialog({
      pendingRequest: request({ id: "p1", requestedLimit: 20 }),
    });
    expect(
      screen.getByText("Request for 20 zones is pending"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("How many zones do you need?"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send request" }),
    ).not.toBeInTheDocument();
  });

  it("explains the maximum and hides the form at 50 zones", () => {
    renderDialog({ currentLimit: 50 });
    expect(
      screen.getByText("You already have the 50-zone maximum."),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("How many zones do you need?"),
    ).not.toBeInTheDocument();
  });

  it("shows the decision status and a show-more control in the history", () => {
    mockHistory(
      [
        request({
          id: "h1",
          requestedLimit: 18,
          status: "APPROVED",
          decidedAt: "2026-11-05T08:00:00.000Z",
          decisionNote: "Approved for the Dhanmondi area",
        }),
        request({ id: "h2", requestedLimit: 25, status: "DENIED" }),
      ],
      { hasNextPage: true },
    );
    renderDialog();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Denied")).toBeInTheDocument();
    expect(
      screen.getByText("Approved for the Dhanmondi area"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show more" }),
    ).toBeInTheDocument();
  });
});
