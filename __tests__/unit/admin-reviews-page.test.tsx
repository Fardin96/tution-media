import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminReviewsPage } from "@/components/admin/reviews-page";
import { apiFetch } from "@/lib/api";
import type { AdminReview } from "@/lib/admin-reviews";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/reviews",
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

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function review(overrides: Partial<AdminReview> & { id: string }): AdminReview {
  return {
    direction: "STUDENT_TO_TUTOR",
    rating: 4,
    comment: "Clear and on time.",
    status: "VISIBLE",
    createdAt: "2026-11-14T08:00:00.000Z",
    updatedAt: "2026-11-14T08:00:00.000Z",
    tutor: { id: "t1", accountId: "a-t", name: "Nusrat Jahan" },
    student: { id: "s1", accountId: "a-s", name: "Rafi Hasan" },
    ...overrides,
  };
}

function mockApi(
  reviews: AdminReview[],
  patch: (init?: RequestInit) => Response = () => respond(reviews[0]),
) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const url = new URL(input, "http://localhost");
    if (init?.method === "PATCH") return patch(init);
    if (url.pathname === "/api/v1/admin/reviews") {
      return respond({ reviews, nextCursor: null });
    }
    return respond({ message: "Not mocked" }, 404);
  });
}

function queries() {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => !init?.method || init.method === "GET")
    .map(([input]) => new URL(input, "http://localhost").searchParams);
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminReviewsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
});

describe("AdminReviewsPage", () => {
  it("opens on Visible and asks the API for visible reviews", async () => {
    mockApi([]);
    renderPage();

    await screen.findByText("No visible reviews match.");
    expect(
      screen.getByRole("button", { name: "Visible", pressed: true }),
    ).toBeInTheDocument();
    expect(queries()[0].get("status")).toBe("VISIBLE");
  });

  it("sends the hidden view, rating and direction filters", async () => {
    nav.search = "view=hidden&rating=2&direction=TUTOR_TO_STUDENT";
    mockApi([]);
    renderPage();

    await screen.findByText("No hidden reviews.");
    const q = queries()[0];
    expect(q.get("status")).toBe("HIDDEN");
    expect(q.get("rating")).toBe("2");
    expect(q.get("direction")).toBe("TUTOR_TO_STUDENT");
  });

  it("sends no status on the All view", async () => {
    nav.search = "view=all";
    mockApi([]);
    renderPage();

    await screen.findByText("No reviews match.");
    expect(queries()[0].get("status")).toBeNull();
  });

  it("shows stars, comment, author to subject and direction", async () => {
    mockApi([review({ id: "r1" })]);
    renderPage();

    expect(await screen.findByText("Clear and on time.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Rated 4 out of 5" })).toBeVisible();
    expect(screen.getByText("Rafi Hasan", { exact: false })).toBeVisible();
    expect(screen.getByText("Student reviewed tutor")).toBeVisible();
  });

  it("requires a note before hiding, then toasts and sends the status", async () => {
    const user = userEvent.setup();
    mockApi([review({ id: "r1" })]);
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Hide review by Rafi Hasan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Hide this review?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Hide review" }),
    );
    expect(
      within(dialog).getByText("Write at least 3 characters."),
    ).toBeInTheDocument();
    expect(
      vi.mocked(apiFetch).mock.calls.filter(([, i]) => i?.method === "PATCH"),
    ).toHaveLength(0);

    await user.type(within(dialog).getByLabelText("Note"), "Abusive language");
    await user.click(
      within(dialog).getByRole("button", { name: "Hide review" }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Review hidden"),
    );
    const [, init] = vi
      .mocked(apiFetch)
      .mock.calls.find(([, i]) => i?.method === "PATCH")!;
    expect(JSON.parse(String(init?.body))).toEqual({
      status: "HIDDEN",
      note: "Abusive language",
    });
  });

  it("restores a hidden review", async () => {
    const user = userEvent.setup();
    nav.search = "view=hidden";
    mockApi([review({ id: "r1", status: "HIDDEN" })]);
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Show review by Rafi Hasan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Show this review again?",
    });
    await user.type(
      within(dialog).getByLabelText("Note"),
      "Checked, it is fine",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Show review" }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Review visible again"),
    );
  });

  it("shows the server message and closes on a 409", async () => {
    const user = userEvent.setup();
    mockApi([review({ id: "r1" })], () =>
      respond(
        {
          error: "Conflict",
          code: "INVALID_REVIEW_STATE",
          message: "This review is already hidden.",
        },
        409,
      ),
    );
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Hide review by Rafi Hasan" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Note"), "Spam");
    await user.click(
      within(dialog).getByRole("button", { name: "Hide review" }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
