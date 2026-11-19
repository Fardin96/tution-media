import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationReviewSection } from "@/components/reviews/application-review-section";
import { apiFetch } from "@/lib/api";
import type { ApplicationDetail } from "@/lib/applications";
import { queryKeys } from "@/lib/query-keys";
import type { MyReview } from "@/lib/reviews";

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

function app(
  status: ApplicationDetail["status"],
  confirmedAt: string | null = null,
): ApplicationDetail {
  return {
    id: "app-1",
    status,
    confirmedAt,
    tutor: { id: "t1", name: "Rafiq Ahmed" },
    student: { id: "s1", name: "Nadia Islam" },
  } as ApplicationDetail;
}

function review(overrides: Partial<MyReview> = {}): MyReview {
  return {
    id: "rev-1",
    direction: "STUDENT_TO_TUTOR",
    rating: 4,
    comment: "Patient and clear.",
    status: "VISIBLE",
    createdAt: "2026-11-10T04:00:00.000Z",
    updatedAt: "2026-11-10T04:00:00.000Z",
    editableUntil: "2026-12-10T04:00:00.000Z",
    canEdit: true,
    subject: { kind: "TUTOR", id: "t1", name: "Rafiq Ahmed" },
    ...overrides,
  };
}

function renderSection(
  status: ApplicationDetail["status"],
  role: "STUDENT" | "TUTOR",
  reviews: MyReview[],
  confirmedAt: string | null = null,
) {
  vi.mocked(apiFetch).mockResolvedValue(respond({ reviews, nextCursor: null }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <ApplicationReviewSection
        application={app(status, confirmedAt)}
        viewerRole={role}
      />
    </QueryClientProvider>,
  );
  return { ...result, client };
}

beforeEach(() => vi.mocked(apiFetch).mockReset());

describe("ApplicationReviewSection", () => {
  it.each(["PENDING", "REJECTED", "WITHDRAWN"] as const)(
    "renders nothing while the application is %s",
    (status) => {
      const { container } = renderSection(status, "STUDENT", []);
      expect(container).toBeEmptyDOMElement();
      expect(apiFetch).not.toHaveBeenCalled();
    },
  );

  it("invites a student to rate the tutor", async () => {
    renderSection("CONFIRMED", "STUDENT", []);
    expect(
      await screen.findByRole("button", { name: "Rate Rafiq Ahmed" }),
    ).toBeInTheDocument();
  });

  it("invites a tutor to rate the student", async () => {
    renderSection("COMPLETED", "TUTOR", []);
    expect(
      await screen.findByRole("button", { name: "Rate Nadia Islam" }),
    ).toBeInTheDocument();
  });

  it("opens the dialog from the rate button", async () => {
    const user = userEvent.setup();
    renderSection("CONFIRMED", "STUDENT", []);
    await user.click(
      await screen.findByRole("button", { name: "Rate Rafiq Ahmed" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Rate Rafiq Ahmed" }),
    ).toBeInTheDocument();
  });

  it("shows my review with Edit and the edit deadline", async () => {
    renderSection("CONFIRMED", "STUDENT", [review()]);
    expect(await screen.findByText("Patient and clear.")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Rated 4 out of 5" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText(/You can edit until/)).toBeInTheDocument();
  });

  it("drops Edit once the window has closed", async () => {
    renderSection("CONFIRMED", "STUDENT", [review({ canEdit: false })]);
    await screen.findByText("Patient and clear.");
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("says when an admin hid the review and blocks editing", async () => {
    renderSection("CONFIRMED", "STUDENT", [review({ status: "HIDDEN" })]);
    expect(await screen.findByText("Hidden by an admin")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("keeps my review on a cancelled tuition that was confirmed", async () => {
    renderSection(
      "CANCELLED",
      "STUDENT",
      [review()],
      "2026-11-01T04:00:00.000Z",
    );
    expect(await screen.findByText("Patient and clear.")).toBeInTheDocument();
    expect(screen.getByText("Your review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("renders nothing on a cancelled tuition with no review, and no Rate button", async () => {
    const { container, client } = renderSection(
      "CANCELLED",
      "STUDENT",
      [],
      "2026-11-01T04:00:00.000Z",
    );
    await waitFor(() =>
      expect(
        client.getQueryState(queryKeys.reviews.mine("app-1"))?.status,
      ).toBe("success"),
    );
    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("button", { name: /Rate/ }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing on a cancelled tuition when the review fails to load", async () => {
    vi.mocked(apiFetch).mockResolvedValue(respond({ message: "x" }, 500));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <QueryClientProvider client={client}>
        <ApplicationReviewSection
          application={app("CANCELLED", "2026-11-01T04:00:00.000Z")}
          viewerRole="STUDENT"
        />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(
        client.getQueryState(queryKeys.reviews.mine("app-1"))?.status,
      ).toBe("error"),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("makes no request for a cancelled tuition that was never confirmed", () => {
    const { container } = renderSection("CANCELLED", "STUDENT", []);
    expect(container).toBeEmptyDOMElement();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
