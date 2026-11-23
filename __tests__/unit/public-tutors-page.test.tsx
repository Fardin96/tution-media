import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PublicTutorsPage } from "@/components/browse/public-tutors-page";
import { apiFetch } from "@/lib/api";

const SUBJECTS = [
  { id: 1, name: "Mathematics" },
  { id: 2, name: "Physics" },
  { id: 5, name: "Chemistry" },
];
const AREAS = [
  { id: 10, name: "Gulshan", district: "Dhaka" },
  { id: 11, name: "Dhanmondi", district: "Dhaka" },
  { id: 20, name: "Agrabad", district: "Chattogram" },
];

const state = vi.hoisted(() => ({
  search: "",
  router: { replace: vi.fn() },
  subjects: {
    subjects: [] as { id: number; name: string }[],
    isSuccess: true,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  areas: {
    areas: [] as { id: number; name: string; district: string }[],
    isSuccess: true,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => state.router,
  usePathname: () => "/tutors",
  useSearchParams: () => new URLSearchParams(state.search),
}));

vi.mock("@/lib/subjects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subjects")>()),
  useSubjects: () => state.subjects,
}));

vi.mock("@/lib/areas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/areas")>()),
  useAreas: () => state.areas,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const TUTOR_1 = {
  id: "tutor-1",
  name: "Nusrat Jahan",
  instituteName: "University of Dhaka",
  gender: "FEMALE",
  avatarUrl: null,
  ratingAvg: 4.5,
  ratingCount: 12,
  areas: [{ id: 10, name: "Gulshan" }],
  subjects: [{ id: 2, name: "Physics" }],
};
const TUTOR_2 = {
  id: "tutor-2",
  name: "Rafi Ahmed",
  instituteName: "BUET",
  gender: "MALE",
  avatarUrl: null,
  ratingAvg: 0,
  ratingCount: 0,
  areas: [{ id: 11, name: "Dhanmondi" }],
  subjects: [{ id: 5, name: "Chemistry" }],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Answers GET /api/v1/tutors with whatever `answer` returns for that request's URL. */
function answerTutors(answer: (url: URL) => unknown) {
  vi.mocked(apiFetch).mockImplementation(async (input: string) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/v1/tutors") return json(answer(url));
    return json({ error: "unexpected" }, 500);
  });
}

/** Every request URL the list has sent, oldest first. */
function listRequests(): URL[] {
  return vi
    .mocked(apiFetch)
    .mock.calls.map((call) => new URL(String(call[0]), "http://localhost"))
    .filter((url) => url.pathname === "/api/v1/tutors");
}

function renderPage(signedIn = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PublicTutorsPage signedIn={signedIn} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  state.router.replace.mockReset();
  state.search = "";
  state.subjects = {
    subjects: SUBJECTS,
    isSuccess: true,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  };
  state.areas = {
    areas: AREAS,
    isSuccess: true,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  };
  answerTutors(() => ({ tutors: [TUTOR_1, TUTOR_2], nextCursor: null }));
});

describe("PublicTutorsPage free text", () => {
  it("swaps a subject name from q for its id and drops q", async () => {
    state.search = "q=physics%20tutor";
    renderPage();

    await waitFor(() =>
      expect(state.router.replace).toHaveBeenCalledWith("/tutors?subject=2", {
        scroll: false,
      }),
    );
    await screen.findByRole("heading", { name: /Nusrat Jahan/ });
    expect(listRequests().at(-1)?.searchParams.get("subject")).toBe("2");
  });

  it("shows a notice and lists every subject when q matches nothing", async () => {
    state.search = "q=zzz";
    renderPage();

    expect(
      await screen.findByText(
        /No subject matches “zzz”, so all subjects are shown\./,
      ),
    ).toBeInTheDocument();
    expect(state.router.replace).not.toHaveBeenCalled();
    await screen.findByRole("heading", { name: /Nusrat Jahan/ });
    expect(listRequests().at(-1)?.searchParams.has("subject")).toBe(false);
  });

  it("swaps a place name from location for its area id", async () => {
    state.search = "location=Gulshan";
    renderPage();

    await waitFor(() =>
      expect(state.router.replace).toHaveBeenCalledWith("/tutors?area=10", {
        scroll: false,
      }),
    );
  });

  it("keeps the list query off until a pending lookup settles", async () => {
    state.subjects = {
      ...state.subjects,
      subjects: [],
      isSuccess: false,
      isError: false,
    };
    state.search = "q=physics";
    renderPage();

    expect(
      await screen.findByText("Loading tutors…", { selector: "span" }),
    ).toBeInTheDocument();
    expect(listRequests()).toHaveLength(0);
  });

  it("reports a failed subject lookup as a failure, not as no match", async () => {
    state.subjects = {
      subjects: [],
      isSuccess: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    };
    state.search = "q=physics";
    renderPage();

    expect(
      await screen.findByText(
        "Couldn't load subjects, so all subjects are shown.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No subject matches/)).not.toBeInTheDocument();
    expect(state.router.replace).not.toHaveBeenCalled();
    await screen.findByRole("heading", { name: /Nusrat Jahan/ });
  });

  it("retries a failed subject lookup from the notice", async () => {
    state.subjects = {
      subjects: [],
      isSuccess: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    };
    state.search = "q=physics";
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(state.subjects.refetch).toHaveBeenCalledTimes(1);
  });
});

describe("PublicTutorsPage sort", () => {
  it("shows the emerging heading and asks for recent tutors", async () => {
    state.search = "sort=emerging";
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Emerging masters" }),
    ).toBeInTheDocument();
    await screen.findByRole("heading", { name: /Nusrat Jahan/ });
    const request = listRequests().at(-1)!;
    expect(request.searchParams.get("recent")).toBe("true");
    expect(request.searchParams.get("limit")).toBe("12");
  });

  it("offers top-rated tutors when no new tutors have joined", async () => {
    answerTutors(() => ({ tutors: [], nextCursor: null }));
    state.search = "sort=emerging";
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("No new tutors yet.")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "See top-rated tutors" }),
    );
    expect(state.router.replace).toHaveBeenCalledWith("/tutors", {
      scroll: false,
    });
  });
});

describe("PublicTutorsPage cards", () => {
  it("links signed-out visitors through sign-in", async () => {
    renderPage(false);

    const link = await screen.findByRole("link", { name: /Nusrat Jahan/ });
    expect(link).toHaveAttribute("href", "/sign-in?next=%2Ftutors%2Ftutor-1");
  });

  it("links signed-in viewers straight to the profile", async () => {
    renderPage(true);

    const link = await screen.findByRole("link", { name: "Nusrat Jahan" });
    expect(link).toHaveAttribute("href", "/tutors/tutor-1");
  });

  it("loads the next page from the cursor when Show more is pressed", async () => {
    answerTutors((url) =>
      url.searchParams.get("cursor") === "c1"
        ? {
            tutors: [{ ...TUTOR_2, id: "tutor-3", name: "Second Page" }],
            nextCursor: null,
          }
        : { tutors: [TUTOR_1], nextCursor: "c1" },
    );
    const user = userEvent.setup();
    renderPage(true);

    await user.click(
      await screen.findByRole("button", { name: "Show more tutors" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Second Page" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nusrat Jahan" }),
    ).toBeInTheDocument();
  });
});
