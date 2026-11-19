import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { StarRating } from "@/components/reviews/star-rating";
import { StarRatingInput } from "@/components/reviews/star-rating-input";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { TutorReviewList } from "@/components/reviews/review-list";
import { apiFetch } from "@/lib/api";
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

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("StarRating", () => {
  it("labels the value for screen readers", () => {
    render(<StarRating value={4.5} />);
    expect(
      screen.getByRole("img", { name: "Rated 4.5 out of 5" }),
    ).toBeVisible();
  });

  it("clamps out-of-range values", () => {
    render(<StarRating value={9} />);
    expect(screen.getByRole("img", { name: "Rated 5 out of 5" })).toBeVisible();
  });
});

function Harness({ initial = 0 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return <StarRatingInput name="r" value={value} onChange={setValue} />;
}

describe("StarRatingInput", () => {
  it("is a radio group of five stars", () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup", { name: "Rating" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(radios[0]).toHaveAccessibleName("1 star");
    expect(radios[4]).toHaveAccessibleName("5 stars");
  });

  it("picks a star by click and names the value", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
    expect(screen.getByText("Very good")).toBeInTheDocument();
  });

  it("moves with the arrow keys and clamps at the ends", async () => {
    const user = userEvent.setup();
    render(<Harness initial={3} />);
    screen.getByRole("radio", { name: "3 stars" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "4 stars" })).toHaveFocus();

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("radio", { name: "1 star" })).toBeChecked();

    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "5 stars" })).toBeChecked();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "5 stars" })).toBeChecked();
  });

  it("previews a star on hover without picking it", async () => {
    const user = userEvent.setup();
    render(<Harness initial={2} />);
    await user.hover(
      screen.getByRole("radio", { name: "5 stars" }).closest("label")!,
    );
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "2 stars" })).toBeChecked();
    await user.unhover(screen.getByRole("radiogroup"));
    expect(screen.getByText("Fair")).toBeInTheDocument();
  });

  it("only the picked star is a tab stop", () => {
    render(<Harness initial={3} />);
    const stops = screen
      .getAllByRole("radio")
      .filter((el) => el.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAccessibleName("3 stars");
  });
});

function mine(overrides: Partial<MyReview> = {}): MyReview {
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

function dialog(existing?: MyReview) {
  const onOpenChange = vi.fn();
  wrap(
    <ReviewDialog
      applicationId="app-1"
      subjectName="Rafiq Ahmed"
      existing={existing}
      open
      onOpenChange={onOpenChange}
    />,
  );
  return onOpenChange;
}

function requests(method: string) {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => init?.method === method);
}

describe("ReviewDialog", () => {
  it("asks for a rating before sending", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValue(respond(mine(), 201));
    dialog();

    await user.click(screen.getByRole("button", { name: "Post review" }));

    expect(
      screen.getByText("Pick a rating from 1 to 5 stars."),
    ).toBeInTheDocument();
    expect(requests("POST")).toHaveLength(0);
  });

  it("posts the rating and trimmed comment, then closes and toasts", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValue(respond(mine(), 201));
    const onOpenChange = dialog();

    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.type(
      screen.getByRole("textbox", { name: /Comment/ }),
      "  Great lessons  ",
    );
    await user.click(screen.getByRole("button", { name: "Post review" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Review posted"),
    );
    const [url, init] = requests("POST")[0];
    expect(new URL(url, "http://localhost").pathname).toBe("/api/v1/reviews");
    expect(JSON.parse(init!.body as string)).toEqual({
      applicationId: "app-1",
      rating: 5,
      comment: "Great lessons",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("omits an empty comment", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValue(respond(mine(), 201));
    dialog();

    await user.click(screen.getByRole("radio", { name: "3 stars" }));
    await user.click(screen.getByRole("button", { name: "Post review" }));

    await waitFor(() => expect(requests("POST")).toHaveLength(1));
    expect(JSON.parse(requests("POST")[0][1]!.body as string)).toEqual({
      applicationId: "app-1",
      rating: 3,
    });
  });

  it("shows a 409 inline and keeps the dialog open", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValue(
      respond({ code: "REVIEW_EXISTS", message: "Already reviewed." }, 409),
    );
    const onOpenChange = dialog();

    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.click(screen.getByRole("button", { name: "Post review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You've already reviewed this person. Edit your review instead.",
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("edits with only the changed fields", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValue(respond(mine({ rating: 5 })));
    dialog(mine());

    expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /Comment/ })).toHaveValue(
      "Patient and clear.",
    );
    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Review updated"),
    );
    const [url, init] = requests("PATCH")[0];
    expect(new URL(url, "http://localhost").pathname).toBe(
      "/api/v1/reviews/rev-1",
    );
    expect(JSON.parse(init!.body as string)).toEqual({ rating: 5 });
  });

  it("sends null when the comment is cleared", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValue(respond(mine({ comment: null })));
    dialog(mine());

    await user.clear(screen.getByRole("textbox", { name: /Comment/ }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(requests("PATCH")).toHaveLength(1));
    expect(JSON.parse(requests("PATCH")[0][1]!.body as string)).toEqual({
      comment: null,
    });
  });

  it("closes without a request when nothing changed", async () => {
    const user = userEvent.setup();
    const onOpenChange = dialog(mine());

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("counts the comment as you type", async () => {
    const user = userEvent.setup();
    dialog();
    await user.type(screen.getByRole("textbox", { name: /Comment/ }), "abc");
    expect(screen.getByText("3/1000")).toBeInTheDocument();
  });
});

function listBody(
  reviews: { id: string; rating: number; comment: string | null }[],
  summary: { ratingAvg: number; ratingCount: number },
  nextCursor: string | null = null,
) {
  return {
    reviews: reviews.map((r) => ({
      ...r,
      createdAt: "2026-11-10T04:00:00.000Z",
      student: { id: "s1", name: "Nadia Islam" },
    })),
    nextCursor,
    summary: {
      ...summary,
      breakdown: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 },
    },
  };
}

describe("TutorReviewList", () => {
  it("shows the summary, the breakdown and each review", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      respond(
        listBody([{ id: "a", rating: 5, comment: "Excellent tutor." }], {
          ratingAvg: 4.25,
          ratingCount: 4,
        }),
      ),
    );
    wrap(<TutorReviewList tutorId="t1" />);

    expect(await screen.findByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("4 reviews")).toBeInTheDocument();
    const breakdown = screen.getByRole("list", { name: "Reviews by rating" });
    expect(within(breakdown).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Excellent tutor.")).toBeInTheDocument();
    expect(screen.getByText("Nadia Islam")).toBeInTheDocument();
    expect(
      new URL(vi.mocked(apiFetch).mock.calls[0][0], "http://localhost")
        .pathname,
    ).toBe("/api/v1/tutors/t1/reviews");
  });

  it("says so when there are no reviews", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      respond(listBody([], { ratingAvg: 0, ratingCount: 0 })),
    );
    wrap(<TutorReviewList tutorId="t1" />);
    expect(await screen.findByText("No reviews yet.")).toBeInTheDocument();
  });

  it("offers Try again when loading fails", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch).mockResolvedValueOnce(respond({ message: "x" }, 500));
    vi.mocked(apiFetch).mockResolvedValue(
      respond(listBody([], { ratingAvg: 0, ratingCount: 0 })),
    );
    wrap(<TutorReviewList tutorId="t1" />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No reviews yet.")).toBeInTheDocument();
  });

  it("loads the next page with Show more", async () => {
    const user = userEvent.setup();
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        respond(
          listBody(
            [{ id: "a", rating: 5, comment: "First one." }],
            { ratingAvg: 4, ratingCount: 2 },
            "cur-2",
          ),
        ),
      )
      .mockResolvedValueOnce(
        respond(
          listBody([{ id: "b", rating: 3, comment: "Second one." }], {
            ratingAvg: 4,
            ratingCount: 2,
          }),
        ),
      );
    wrap(<TutorReviewList tutorId="t1" />);

    await user.click(await screen.findByRole("button", { name: "Show more" }));

    expect(await screen.findByText("Second one.")).toBeInTheDocument();
    expect(screen.getByText("First one.")).toBeInTheDocument();
    expect(String(vi.mocked(apiFetch).mock.calls[1][0])).toContain(
      "cursor=cur-2",
    );
    expect(
      screen.queryByRole("button", { name: "Show more" }),
    ).not.toBeInTheDocument();
  });
});
