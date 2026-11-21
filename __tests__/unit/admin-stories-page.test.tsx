import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminStoriesPage } from "@/components/admin/stories-page";
import { ADMIN_NAV } from "@/components/admin/admin-shell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/admin";
import { actionLabel } from "@/lib/admin-audit";
import type { AdminStory } from "@/lib/admin-stories";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/stories",
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

function story(overrides: Partial<AdminStory> & { id: string }): AdminStory {
  return {
    author: { accountId: "a-s", name: "Rafi Hasan", role: "STUDENT" },
    role: "STUDENT",
    headline: "Finally passed my O levels",
    body: "My tutor was patient and kept every lesson on time.",
    status: "PENDING",
    note: null,
    noteVisible: true,
    image: null,
    video: null,
    consentAt: "2026-11-10T09:00:00.000Z",
    createdAt: "2026-11-12T08:00:00.000Z",
    decidedAt: null,
    onLanding: false,
    ...overrides,
  };
}

function mockApi(
  stories: AdminStory[],
  moderate: (init?: RequestInit) => Response = () => respond(stories[0]),
) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const url = new URL(input, "http://localhost");
    if (init?.method === "POST") return moderate(init);
    if (url.pathname === "/api/v1/admin/stories") {
      return respond({ stories, nextCursor: null });
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

function moderationBodies() {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminStoriesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
});

describe("AdminStoriesPage", () => {
  it("lists pending stories with author, consent date and media", async () => {
    mockApi([
      story({
        id: "s1",
        image: {
          url: "https://files.example.test/story.jpg",
          contentType: "image/jpeg",
          originalName: "story.jpg",
        },
      }),
      story({
        id: "s2",
        author: { accountId: "a-t", name: "Nusrat Jahan", role: "TUTOR" },
        role: "TUTOR",
        headline: null,
        body: "Clear explanations.",
        video: {
          url: "https://files.example.test/story.mp4",
          contentType: "video/mp4",
          originalName: "story.mp4",
        },
      }),
    ]);
    renderPage();

    expect(await screen.findByText("Rafi Hasan")).toBeVisible();
    expect(screen.getByText("Student")).toBeVisible();
    expect(screen.getByText("Nusrat Jahan")).toBeVisible();
    expect(screen.getByText("Tutor")).toBeVisible();
    expect(
      screen.getAllByText(
        `Agreed to home page use on ${formatDateTime("2026-11-10T09:00:00.000Z")}`,
      ),
    ).toHaveLength(2);
    expect(screen.getByText("Finally passed my O levels")).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Photo from Rafi Hasan" }),
    ).toHaveAttribute("src", "https://files.example.test/story.jpg");
    const video = screen.getByLabelText("Video from Nusrat Jahan");
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(queries()[0].get("status")).toBe("PENDING");
  });

  it("approves without a note and toasts", async () => {
    const user = userEvent.setup();
    mockApi([story({ id: "s1" })]);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Approve this story?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Story approved"),
    );
    expect(moderationBodies()).toEqual([{ decision: "APPROVE" }]);
  });

  it("requires a note to reject and sends nothing until it is written", async () => {
    const user = userEvent.setup();
    mockApi([story({ id: "s1" })]);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Reject this story?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    expect(
      within(dialog).getByText("Write a note explaining why."),
    ).toBeInTheDocument();
    expect(moderationBodies()).toHaveLength(0);
  });

  it("sends the note and noteVisible when rejecting", async () => {
    const user = userEvent.setup();
    mockApi([story({ id: "s1" })]);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Reject this story?",
    });
    await user.type(
      within(dialog).getByLabelText("Why is this rejected?"),
      "Contains a phone number",
    );
    await user.click(
      within(dialog).getByRole("checkbox", {
        name: /Show this note to the user/,
      }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Story rejected"),
    );
    expect(moderationBodies()).toEqual([
      {
        decision: "REJECT",
        note: "Contains a phone number",
        noteVisible: false,
      },
    ]);
  });

  it("marks an approved story on the home page and warns before rejecting it", async () => {
    const user = userEvent.setup();
    nav.search = "status=APPROVED";
    mockApi([story({ id: "s1", status: "APPROVED", onLanding: true })]);
    renderPage();

    expect(await screen.findByText("On the home page")).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Reject this story?",
    });
    expect(
      within(dialog).getByText(
        "The author sees your note. This takes it off the home page.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the server message on a 409 and closes the dialog", async () => {
    const user = userEvent.setup();
    mockApi([story({ id: "s1" })], () =>
      respond(
        {
          error: "Conflict",
          code: "STORY_ALREADY_MODERATED",
          message: "This story already has that decision.",
        },
        409,
      ),
    );
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Approve this story?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This story already has that decision.",
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("updates the status and role params and sends the role filter", async () => {
    const user = userEvent.setup();
    mockApi([]);
    renderPage();

    await screen.findByText("No stories waiting for review.");
    expect(
      screen.getByRole("button", { name: "Waiting for review", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "All", pressed: true }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approved" }));
    expect(nav.replace).toHaveBeenLastCalledWith(
      "/dashboard/admin/stories?status=APPROVED",
      { scroll: false },
    );

    await user.click(screen.getByRole("button", { name: "Tutors" }));
    expect(nav.replace).toHaveBeenLastCalledWith(
      "/dashboard/admin/stories?status=PENDING&role=TUTOR",
      { scroll: false },
    );
  });

  it("sends the role from the URL and shows the view's empty copy", async () => {
    nav.search = "status=REJECTED&role=STUDENT";
    mockApi([]);
    renderPage();

    await screen.findByText("No rejected stories.");
    const q = queries()[0];
    expect(q.get("status")).toBe("REJECTED");
    expect(q.get("role")).toBe("STUDENT");
    expect(
      screen.getByRole("button", { name: "Students", pressed: true }),
    ).toBeInTheDocument();
  });
});

describe("Stories admin wiring", () => {
  it("puts Stories in the nav right after Reviews", () => {
    const labels = ADMIN_NAV.map((item) => item.label);
    expect(labels.indexOf("Stories")).toBe(labels.indexOf("Reviews") + 1);
    expect(ADMIN_NAV.find((item) => item.label === "Stories")?.href).toBe(
      "/dashboard/admin/stories",
    );
  });

  it("labels the story and site content audit actions", () => {
    expect(actionLabel("story.moderate")).toBe("Reviewed a story");
    expect(actionLabel("site_content.source_removed")).toBe(
      "Took a submission off the home page",
    );
  });
});
