import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationReviewSection } from "@/components/reviews/application-review-section";
import { apiFetch } from "@/lib/api";
import type { ApplicationDetail } from "@/lib/applications";
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

function app(status: ApplicationDetail["status"]): ApplicationDetail {
  return {
    id: "app-1",
    status,
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
) {
  vi.mocked(apiFetch).mockResolvedValue(respond({ reviews, nextCursor: null }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ApplicationReviewSection application={app(status)} viewerRole={role} />
    </QueryClientProvider>,
  );
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
});
