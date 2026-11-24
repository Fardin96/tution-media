import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RecommendedTutors,
  Stats,
  StudentReviewsSection,
} from "@/components/profile/profile-dashboard";
import { useMyStats } from "@/lib/profile";
import { useStudentReviews } from "@/lib/reviews";
import { requirementApi, type Requirement } from "@/lib/requirements";
import {
  useRecommendedTutors,
  type RecommendedTutor,
} from "@/lib/applications";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile")>()),
  useMyStats: vi.fn(),
}));

vi.mock("@/lib/requirements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/requirements")>();
  return {
    ...actual,
    requirementApi: { ...actual.requirementApi, mine: vi.fn() },
  };
});

vi.mock("@/lib/applications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/applications")>()),
  useRecommendedTutors: vi.fn(),
}));

vi.mock("@/lib/reviews", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reviews")>()),
  useStudentReviews: vi.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>,
  );
}

/** A query result as the stats hook returns it. */
function statsResult(
  data: unknown,
  state: { isError?: boolean; isPending?: boolean } = {},
) {
  return {
    data,
    isError: state.isError ?? false,
    isPending: state.isPending ?? data === undefined,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useMyStats>;
}

/** The list item for a tile, found by its label. */
function tile(label: string): HTMLElement {
  const item = screen.getByText(label).closest("li");
  if (!item) throw new Error(`no tile for ${label}`);
  return item;
}

describe("Stats for a tutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the counts from the stats API, with no sample numbers", () => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult({
        role: "TUTOR",
        applicationsSent: 12,
        activeStudents: 3,
        invitesReceived: 5,
      }),
    );
    renderWithClient(
      <Stats role="TUTOR" profileId="tutor-1" rating={4.5} ratingCount={2} />,
    );

    expect(within(tile("Applications sent")).getByText("12")).toBeVisible();
    expect(within(tile("Active students")).getByText("3")).toBeVisible();
    expect(within(tile("Invites received")).getByText("5")).toBeVisible();
    expect(screen.queryByText("Sample")).not.toBeInTheDocument();
    expect(screen.queryByText("Profile views")).not.toBeInTheDocument();
  });

  it("links each count to the page that counts it", () => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult({
        role: "TUTOR",
        applicationsSent: 1,
        activeStudents: 1,
        invitesReceived: 1,
      }),
    );
    renderWithClient(
      <Stats role="TUTOR" profileId="tutor-1" rating={4.5} ratingCount={2} />,
    );

    expect(
      screen.getByRole("link", { name: /Invites received/ }),
    ).toHaveAttribute("href", "/dashboard/find-tuitions?scope=invited");
    expect(
      screen.getByRole("link", { name: /Active students/ }),
    ).toHaveAttribute("href", "/dashboard/applications?status=CONFIRMED");
    expect(screen.getByRole("link", { name: /Rating/ })).toHaveAttribute(
      "href",
      "/tutors/tutor-1",
    );
  });

  it("shows the rating to one decimal with the review count", () => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult({
        role: "TUTOR",
        applicationsSent: 0,
        activeStudents: 0,
        invitesReceived: 0,
      }),
    );
    renderWithClient(
      <Stats role="TUTOR" profileId="tutor-1" rating={4.25} ratingCount={2} />,
    );

    expect(within(tile("Rating · 2 reviews")).getByText("4.3")).toBeVisible();
  });

  it("shows No reviews yet instead of 0.0 when there are no reviews", () => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult({
        role: "TUTOR",
        applicationsSent: 0,
        activeStudents: 0,
        invitesReceived: 0,
      }),
    );
    renderWithClient(
      <Stats role="TUTOR" profileId="tutor-1" rating={0} ratingCount={0} />,
    );

    expect(screen.getByText("No reviews yet")).toBeVisible();
    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
  });

  it("shows a dash, not 0, when the stats request fails", () => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult(undefined, { isError: true, isPending: false }),
    );
    renderWithClient(
      <Stats role="TUTOR" profileId="tutor-1" rating={4.5} ratingCount={2} />,
    );

    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getAllByText("Couldn't load")).toHaveLength(3);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    // The rating comes from /me, so it still shows.
    expect(screen.getByText("4.5")).toBeVisible();
  });

  it("keeps the last counts when a background refresh fails", () => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult(
        {
          role: "TUTOR",
          applicationsSent: 12,
          activeStudents: 3,
          invitesReceived: 5,
        },
        { isError: true },
      ),
    );
    renderWithClient(
      <Stats role="TUTOR" profileId="tutor-1" rating={4.5} ratingCount={2} />,
    );

    expect(within(tile("Applications sent")).getByText("12")).toBeVisible();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  it("offers Retry when the stats fail with no data, and retries them", async () => {
    const result = statsResult(undefined, { isError: true, isPending: false });
    vi.mocked(useMyStats).mockReturnValue(result);
    renderWithClient(
      <Stats role="TUTOR" profileId="tutor-1" rating={4.5} ratingCount={2} />,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry" }));
    expect(result.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows no number while the counts load, and says so to screen readers", () => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult(undefined, { isPending: true }),
    );
    renderWithClient(
      <Stats role="TUTOR" profileId="tutor-1" rating={0} ratingCount={0} />,
    );

    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("Invites received")).toBeVisible();
    expect(screen.getAllByText("Loading")).toHaveLength(3);
  });

  it.each([
    ["Applications sent", "/dashboard/applications?initiatedBy=TUTOR"],
    ["Active students", "/dashboard/applications?status=CONFIRMED"],
    ["Invites received", "/dashboard/find-tuitions?scope=invited"],
    ["Rating · 2 reviews", "/tutors/tutor-1"],
  ])("links the %s tile to %s", (label, href) => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult({
        role: "TUTOR",
        applicationsSent: 4,
        activeStudents: 2,
        invitesReceived: 3,
      }),
    );
    renderWithClient(
      <Stats role="TUTOR" profileId="tutor-1" rating={4.5} ratingCount={2} />,
    );

    expect(tile(label).querySelector("a")).toHaveAttribute("href", href);
  });
});

describe("Stats for a student", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the student's counts, not sample numbers", () => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult({
        role: "STUDENT",
        openRequirements: 2,
        applicationsReceived: 7,
        tutorsHired: 1,
      }),
    );
    renderWithClient(
      <Stats role="STUDENT" profileId="student-1" rating={0} ratingCount={0} />,
    );

    expect(within(tile("Open requirements")).getByText("2")).toBeVisible();
    expect(within(tile("Applications received")).getByText("7")).toBeVisible();
    expect(within(tile("Tutors hired")).getByText("1")).toBeVisible();
    expect(screen.queryByText("Sample")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open requirements/ }),
    ).toHaveAttribute("href", "#requirements");
  });

  it.each([
    ["Open requirements", "#requirements"],
    ["Applications received", "/dashboard/applications?initiatedBy=TUTOR"],
    ["Tutors hired", "/dashboard/applications"],
    ["Rating · 1 review", "#reviews"],
  ])("links the %s tile to %s", (label, href) => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult({
        role: "STUDENT",
        openRequirements: 1,
        applicationsReceived: 5,
        tutorsHired: 1,
      }),
    );
    renderWithClient(
      <Stats role="STUDENT" profileId="student-1" rating={4} ratingCount={1} />,
    );

    expect(tile(label).querySelector("a")).toHaveAttribute("href", href);
  });

  it("keeps the rating tile at its count when there are no reviews", () => {
    vi.mocked(useMyStats).mockReturnValue(
      statsResult({
        role: "STUDENT",
        openRequirements: 0,
        applicationsReceived: 0,
        tutorsHired: 0,
      }),
    );
    renderWithClient(
      <Stats role="STUDENT" profileId="student-1" rating={0} ratingCount={0} />,
    );

    expect(tile("Rating").querySelector("a")).toHaveAttribute(
      "href",
      "#reviews",
    );
    expect(within(tile("Rating")).getByText("No reviews yet")).toBeVisible();
  });
});

describe("StudentReviewsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the reviews under the id the rating tile links to", () => {
    vi.mocked(useStudentReviews).mockReturnValue({
      data: {
        pages: [
          {
            summary: {
              ratingAvg: 0,
              ratingCount: 0,
              breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            },
            reviews: [],
            nextCursor: null,
          },
        ],
        pageParams: [undefined],
      },
      isPending: false,
      isError: false,
      isFetching: false,
      hasNextPage: false,
    } as unknown as ReturnType<typeof useStudentReviews>);
    const { container } = renderWithClient(
      <StudentReviewsSection profileId="student-1" />,
    );

    expect(container.querySelector("#reviews")).toHaveAttribute(
      "aria-labelledby",
      "reviews-heading",
    );
    expect(
      screen.getByRole("heading", { name: "Reviews about you" }),
    ).toBeVisible();
    expect(screen.getByText("No reviews yet.")).toBeVisible();
    expect(useStudentReviews).toHaveBeenCalledWith("student-1");
  });

  it("points a student from a review to the application that holds it", () => {
    vi.mocked(useStudentReviews).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: false,
      hasNextPage: false,
    } as unknown as ReturnType<typeof useStudentReviews>);
    renderWithClient(<StudentReviewsSection profileId="student-1" />);

    expect(
      screen.getByText(
        "What tutors wrote after working with you. If a review breaks the rules, report it from that application.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Your applications" }),
    ).toHaveAttribute("href", "/dashboard/applications");
  });

  it("moves focus to the reviews section when the Rating tile is clicked", async () => {
    vi.mocked(useStudentReviews).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: false,
      hasNextPage: false,
    } as unknown as ReturnType<typeof useStudentReviews>);
    vi.mocked(useMyStats).mockReturnValue(
      statsResult({
        role: "STUDENT",
        openRequirements: 0,
        applicationsReceived: 0,
        tutorsHired: 0,
      }),
    );
    renderWithClient(
      <>
        <Stats
          role="STUDENT"
          profileId="student-1"
          rating={4}
          ratingCount={1}
        />
        <StudentReviewsSection profileId="student-1" />
      </>,
    );

    await userEvent
      .setup()
      .click(tile("Rating · 1 review").querySelector("a") as Element);

    expect(document.getElementById("reviews")).toHaveFocus();
  });
});

const REQUIREMENT_DATE = "2026-05-01T04:00:00Z";

function requirement(
  id: string,
  status: Requirement["status"],
  createdAt = REQUIREMENT_DATE,
): Requirement {
  return {
    institutionId: null,
    id,
    studentId: "stu-1",
    areaId: null,
    subjectIds: [1],
    curriculum: null,
    levelCode: null,
    academicGroup: null,
    admissionTargets: [],
    isRetaker: false,
    levelNote: null,
    timeOfDay: null,
    daysPerWeek: null,
    availableDays: 127,
    salary: null,
    studentCount: null,
    hireByDate: "2026-12-01",
    tutorGenderPref: "ANY",
    instituteName: null,
    tuitionType: null,
    status,
    createdAt,
    updatedAt: createdAt,
  };
}

function matchedTutor(id: string, name: string): RecommendedTutor {
  return {
    tutor: {
      id,
      name,
      instituteName: "Dhaka College",
      gender: "FEMALE",
      ratingAvg: 4.5,
      ratingCount: 3,
      verifiedBadge: false,
      verificationStatus: "APPROVED",
      avatarUrl: null,
      areas: [],
      subjects: [],
    },
    reasons: [],
    invitedAt: null,
    application: null,
  };
}

/** A recommendation list result with one page of rows. */
function matchResult(tutors: RecommendedTutor[]) {
  return {
    data: {
      pages: [
        {
          tutors,
          total: tutors.length,
          page: 1,
          hasMore: false,
          matchVersion: 1,
          suggestions: [],
        },
      ],
      pageParams: [1],
    },
    isPending: false,
    isError: false,
    isFetching: false,
    hasNextPage: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useRecommendedTutors>;
}

describe("RecommendedTutors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRecommendedTutors).mockReturnValue(matchResult([]));
  });

  it("matches the newest open requirement, using the dashboard's copy", () => {
    renderWithClient(
      <RecommendedTutors
        requirements={[
          requirement("old-open", "OPEN", "2026-04-01T04:00:00Z"),
          requirement("draft", "DRAFT", "2026-06-10T04:00:00Z"),
          requirement("new-open", "OPEN", "2026-06-01T04:00:00Z"),
        ]}
        onRetry={vi.fn()}
        retrying={false}
      />,
    );

    expect(useRecommendedTutors).toHaveBeenLastCalledWith("new-open", true);
    expect(requirementApi.mine).not.toHaveBeenCalled();
  });

  it("shows the top four matches, each linked to its profile", async () => {
    vi.mocked(useRecommendedTutors).mockReturnValue(
      matchResult([
        matchedTutor("t1", "Tutor One"),
        matchedTutor("t2", "Tutor Two"),
        matchedTutor("t3", "Tutor Three"),
        matchedTutor("t4", "Tutor Four"),
        matchedTutor("t5", "Tutor Five"),
      ]),
    );
    renderWithClient(
      <RecommendedTutors
        requirements={[requirement("open-1", "OPEN")]}
        onRetry={vi.fn()}
        retrying={false}
      />,
    );

    expect(
      await screen.findByRole("link", { name: "Tutor One" }),
    ).toHaveAttribute("href", "/tutors/t1");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(screen.queryByText("Tutor Five")).not.toBeInTheDocument();
    expect(screen.queryByText("Sample")).not.toBeInTheDocument();
  });

  it("asks the student to post a requirement when none is open", () => {
    renderWithClient(
      <RecommendedTutors
        requirements={[requirement("closed-1", "CLOSED")]}
        onRetry={vi.fn()}
        retrying={false}
      />,
    );

    expect(
      screen.getByText("Post a requirement to see matched tutors."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Post a requirement" }),
    ).toHaveAttribute("href", "/dashboard/requirements/new");
    expect(useRecommendedTutors).toHaveBeenLastCalledWith("", false);
  });

  it("shows the zero-match state when the open requirement has no matches", () => {
    renderWithClient(
      <RecommendedTutors
        requirements={[requirement("open-1", "OPEN")]}
        onRetry={vi.fn()}
        retrying={false}
      />,
    );

    expect(
      screen.getByText("No tutors match your open requirement yet."),
    ).toBeVisible();
  });

  it("shows a loading status while the matches load", () => {
    vi.mocked(useRecommendedTutors).mockReturnValue({
      ...matchResult([]),
      data: undefined,
      isPending: true,
    } as unknown as ReturnType<typeof useRecommendedTutors>);
    renderWithClient(
      <RecommendedTutors
        requirements={[requirement("open-1", "OPEN")]}
        onRetry={vi.fn()}
        retrying={false}
      />,
    );

    expect(screen.getByText("Loading recommended tutors…")).toBeInTheDocument();
  });

  it("shows an error with Try again when the dashboard could not load requirements", async () => {
    const onRetry = vi.fn();
    renderWithClient(
      <RecommendedTutors
        requirements={null}
        onRetry={onRetry}
        retrying={false}
      />,
    );

    expect(screen.getByText("Couldn't load your requirements.")).toBeVisible();
    expect(useRecommendedTutors).toHaveBeenLastCalledWith("", false);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(requirementApi.mine).not.toHaveBeenCalled();
  });

  it("shows Try again as pending while the dashboard retries the requirements", () => {
    renderWithClient(
      <RecommendedTutors requirements={null} onRetry={vi.fn()} retrying />,
    );

    const button = screen.getByRole("button", { name: "Try again" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
