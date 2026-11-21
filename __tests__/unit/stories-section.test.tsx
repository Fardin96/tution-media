import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { StoriesSection } from "@/components/stories/stories-section";
import { apiFetch } from "@/lib/api";
import type { Story, StoryList } from "@/lib/stories";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const UPLOAD_STATUS = {
  blocksVideos: false,
  blocksDocuments: false,
  note: null,
  blockedAt: null,
};

function story(over: Partial<Story> & Pick<Story, "id">): Story {
  return {
    role: "STUDENT",
    headline: null,
    body: "Maths got easier after the first month.",
    status: "PENDING",
    note: null,
    image: null,
    video: null,
    createdAt: "2026-11-02T10:00:00Z",
    decidedAt: null,
    onLanding: false,
    ...over,
  };
}

const FULL_LIST: StoryList = {
  stories: [
    story({
      id: "s-approved",
      headline: "Ana passed her SSC",
      status: "APPROVED",
      onLanding: true,
    }),
    story({ id: "s-pending", headline: "Ben's first term" }),
    story({
      id: "s-rejected",
      headline: "Chloe's review",
      status: "REJECTED",
      note: "Please shorten the story.",
    }),
  ],
  max: 3,
  canSubmit: false,
  blockedReason: "LIMIT",
};

/** Routes the calls the section makes; anything else is a 404. */
function api(
  handler: (method: string, path: string, body: unknown) => Response | null,
) {
  vi.mocked(apiFetch).mockImplementation(async (url, init) => {
    const { pathname } = new URL(String(url));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const method = String(init?.method ?? "GET");
    return (
      handler(method, pathname, body) ??
      json(404, { error: "NotFound", code: "NOT_FOUND", message: "Not found." })
    );
  });
}

function renderSection(role: "STUDENT" | "TUTOR", list: StoryList) {
  api((method, path) => {
    if (path === "/api/v1/files/upload-status") return json(200, UPLOAD_STATUS);
    if (method === "GET" && path === "/api/v1/me/stories")
      return json(200, list);
    if (method === "DELETE" && path.startsWith("/api/v1/me/stories/"))
      return new Response(null, { status: 204 });
    return null;
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StoriesSection role={role} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("StoriesSection for students", () => {
  it("lists each story with its status, the home page pill and the admin note", async () => {
    renderSection("STUDENT", FULL_LIST);

    expect(await screen.findByText("Ana passed her SSC")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("On the home page")).toBeInTheDocument();
    expect(screen.getByText("Waiting for review")).toBeInTheDocument();
    expect(screen.getByText("Not approved")).toBeInTheDocument();
    expect(
      screen.getByText("Admin note: Please shorten the story."),
    ).toBeInTheDocument();
  });

  it("hides Add story and explains the limit when a new one can't be sent", async () => {
    renderSection("STUDENT", FULL_LIST);

    await screen.findByText("Ana passed her SSC");
    expect(
      screen.queryByRole("button", { name: "Add story" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "You have 3 stories, the most allowed. Delete one to send another.",
      ),
    ).toBeInTheDocument();
  });

  it("offers Add story when a new one can be sent", async () => {
    renderSection("STUDENT", {
      ...FULL_LIST,
      stories: [],
      canSubmit: true,
      blockedReason: null,
    });

    expect(
      await screen.findByRole("button", { name: "Add story" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No testimonials yet")).toBeInTheDocument();
  });

  it("asks before deleting, then sends DELETE and toasts", async () => {
    renderSection("STUDENT", FULL_LIST);
    await screen.findByText("Ana passed her SSC");

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Ana passed her SSC" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete this story?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /It is removed from your dashboard and, if it is on our home page, from there too\./,
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete story" }),
    );

    await waitFor(() =>
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/me/stories/s-approved"),
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Story deleted"),
    );
  });

  it("keeps the story when the user cancels the delete", async () => {
    renderSection("STUDENT", FULL_LIST);
    await screen.findByText("Ana passed her SSC");

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Ana passed her SSC" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Keep story" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(
      vi
        .mocked(apiFetch)
        .mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);
  });
});
