import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TutorProfilePage } from "@/components/tutor-profile/tutor-profile-page";
import { ApiError } from "@/lib/profile";
import {
  formatMemberSince,
  tutorProfileApi,
  useTutorProfile,
  type PublicTutor,
} from "@/lib/tutor-profile";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/reviews/review-list", () => ({
  TutorReviewList: ({ tutorId }: { tutorId: string }) => (
    <p>Reviews stub for {tutorId}</p>
  ),
}));

vi.mock("@/lib/tutor-profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tutor-profile")>()),
  useTutorProfile: vi.fn(),
}));

const TUTOR: PublicTutor = {
  id: "tutor-1",
  name: "Nusrat Jahan",
  avatarUrl: null,
  instituteName: "University of Dhaka",
  gender: "FEMALE",
  ratingAvg: 4.5,
  ratingCount: 12,
  verificationStatus: "APPROVED",
  isListed: true,
  needsReaddress: false,
  createdAt: "2026-10-31T19:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  areas: [
    { id: 1, name: "Dhanmondi" },
    { id: 2, name: "Banani" },
  ],
  subjects: [
    { id: 5, name: "Physics" },
    { id: 7, name: "Biology" },
  ],
  credentials: [
    {
      id: "cred-1",
      examLabel: "SSC",
      result: "A+",
      file: { id: "file-1", status: "UPLOADED" },
    },
  ],
  videos: [
    {
      id: "vid-1",
      title: "Intro to Physics",
      sortOrder: 0,
      createdAt: "2026-11-02T00:00:00.000Z",
      url: "https://cdn.example.com/intro.mp4",
      file: { id: "file-2", status: "UPLOADED" },
    },
    {
      id: "vid-2",
      title: "Draft lesson",
      sortOrder: 1,
      createdAt: "2026-11-03T00:00:00.000Z",
      url: null,
      file: { id: "file-3", status: "PENDING_UPLOAD" },
    },
  ],
};

type QueryState = Partial<ReturnType<typeof useTutorProfile>>;

function mockQuery(state: QueryState) {
  vi.mocked(useTutorProfile).mockReturnValue({
    data: undefined,
    error: null,
    isError: false,
    isPending: false,
    refetch: vi.fn(),
    ...state,
  } as unknown as ReturnType<typeof useTutorProfile>);
}

function renderPage(
  id = "tutor-1",
  props: { initialProfile?: PublicTutor; signedIn?: boolean } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TutorProfilePage id={id} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(useTutorProfile).mockReset();
});

describe("formatMemberSince", () => {
  it("formats the month and year", () => {
    expect(formatMemberSince("2026-11-15T06:00:00.000Z")).toBe("November 2026");
  });

  it("uses Dhaka time, so an instant just before Dhaka midnight is still the old month", () => {
    // 17:59 UTC on 31 October is 23:59 on 31 October in Dhaka (UTC+6).
    expect(formatMemberSince("2026-10-31T17:59:59.000Z")).toBe("October 2026");
    // One second later it is 1 November in Dhaka.
    expect(formatMemberSince("2026-10-31T18:00:00.000Z")).toBe("November 2026");
  });

  it("returns the raw value when it is not a date", () => {
    expect(formatMemberSince("not a date")).toBe("not a date");
  });
});

describe("TutorProfilePage", () => {
  it("shows the loaded profile: name, institute, subjects, areas and credentials", () => {
    mockQuery({ data: TUTOR });
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Nusrat Jahan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("University of Dhaka")).toBeInTheDocument();
    expect(screen.getByText("Member since November 2026")).toBeInTheDocument();

    const subjects = screen.getByRole("region", { name: "Subjects" });
    expect(
      within(subjects)
        .getAllByRole("listitem")
        .map((chip) => chip.textContent),
    ).toEqual(["Physics", "Biology"]);

    const areas = screen.getByRole("region", { name: "Areas" });
    expect(within(areas).getByText("Dhanmondi")).toBeInTheDocument();
    expect(within(areas).getByText("Banani")).toBeInTheDocument();

    const credentials = screen.getByRole("region", { name: "Credentials" });
    expect(within(credentials).getByText("SSC — A+")).toBeInTheDocument();
  });

  it("shows the Verified badge only when the tutor is approved", () => {
    mockQuery({ data: TUTOR });
    const { unmount } = renderPage();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    unmount();

    mockQuery({ data: { ...TUTOR, verificationStatus: "PENDING" } });
    renderPage();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("plays only the videos that have a url, with the title as the label", () => {
    mockQuery({ data: TUTOR });
    renderPage();

    const videos = screen.getByRole("region", { name: "Videos" });
    const players = within(videos).getAllByLabelText(/./, {
      selector: "video",
    });
    expect(players).toHaveLength(1);
    expect(players[0]).toHaveAttribute(
      "src",
      "https://cdn.example.com/intro.mp4",
    );
    expect(players[0]).toHaveAccessibleName("Intro to Physics");
    expect(screen.queryByText("Draft lesson")).not.toBeInTheDocument();
  });

  it("hides the sections that have no data but keeps the reviews section", () => {
    mockQuery({
      data: {
        ...TUTOR,
        instituteName: null,
        subjects: [],
        areas: [],
        credentials: [],
        videos: [],
      },
    });
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Nusrat Jahan" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("University of Dhaka")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Subjects" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Areas" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Credentials" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Videos" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Reviews" })).toHaveTextContent(
      "Reviews stub for tutor-1",
    );
  });

  it("shows a loading state while the profile is pending", () => {
    mockQuery({ data: undefined, isPending: true });
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("passes the server copy and the signed-in flag to the hook", () => {
    mockQuery({ data: TUTOR });
    renderPage("tutor-1", { initialProfile: TUTOR, signedIn: true });

    expect(useTutorProfile).toHaveBeenCalledWith("tutor-1", {
      initialData: TUTOR,
      signedIn: true,
    });
  });

  it("says the profile is not available when the API answers 404", () => {
    mockQuery({
      data: undefined,
      isError: true,
      isPending: false,
      error: new ApiError("Not found", 404),
    });
    renderPage("hidden-1");

    expect(
      screen.getByRole("heading", {
        name: "This tutor profile isn't available.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("shows a retry control for other errors and refetches on click", async () => {
    const refetch = vi.fn();
    mockQuery({
      data: undefined,
      isError: true,
      isPending: false,
      error: new ApiError("Server error", 500),
      refetch,
    });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load this tutor profile.",
    );
    expect(
      screen.queryByText("This tutor profile isn't available."),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("TutorProfilePage with the server-rendered copy", () => {
  // These run the real hook (the block above mocks it) and spy on the request it makes.
  let get: MockInstance<typeof tutorProfileApi.get>;

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import("@/lib/tutor-profile")>(
      "@/lib/tutor-profile",
    );
    vi.mocked(useTutorProfile).mockImplementation(actual.useTutorProfile);
    get = vi.spyOn(tutorProfileApi, "get").mockResolvedValue(TUTOR);
  });

  afterEach(() => {
    get.mockRestore();
  });

  it("renders the server copy without a request for an anonymous visitor", async () => {
    renderPage("tutor-1", { initialProfile: TUTOR, signedIn: false });

    expect(
      screen.getByRole("heading", { level: 1, name: "Nusrat Jahan" }),
    ).toBeInTheDocument();
    // Give any mount-time fetch a chance to start before asserting none did.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(get).not.toHaveBeenCalled();
  });

  it("renders the server copy and refetches at once for a signed-in viewer", async () => {
    renderPage("tutor-1", { initialProfile: TUTOR, signedIn: true });

    expect(
      screen.getByRole("heading", { level: 1, name: "Nusrat Jahan" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith("tutor-1"));
  });

  it("requests the profile on the client when the server had no copy", async () => {
    renderPage("tutor-1", { signedIn: false });

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Nusrat Jahan" }),
      ).toBeInTheDocument(),
    );
    expect(get).toHaveBeenCalledWith("tutor-1");
  });
});
