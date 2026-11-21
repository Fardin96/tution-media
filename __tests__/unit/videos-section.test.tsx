import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { VideosSection } from "@/components/profile/profile-dashboard";
import { apiFetch } from "@/lib/api";
import type { Video } from "@/lib/profile";

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

function video(over: Partial<Video> = {}): Video {
  return {
    id: "v-1",
    title: "Algebra",
    status: "APPROVED",
    moderationNote: null,
    showOnHomePage: false,
    sortOrder: 0,
    createdAt: "2026-10-01T00:00:00Z",
    url: null,
    file: { id: "f-1", status: "UPLOADED" },
    ...over,
  };
}

const HINT =
  "Ticking it lets admins add the video to our home page. Untick it to take it off at once.";

function renderVideos(list: Video[], onUpdated = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <VideosSection
        videos={list}
        onRemove={vi.fn()}
        onAdded={vi.fn()}
        onUpdated={onUpdated}
      />
    </QueryClientProvider>,
  );
  return { onUpdated };
}

/** Answers the upload-status read and the PATCH for the video, with the given reply. */
function api(patch: () => Response) {
  vi.mocked(apiFetch).mockImplementation(async (url, init) => {
    const { pathname } = new URL(String(url));
    if (pathname === "/api/v1/files/upload-status")
      return json(200, {
        blocksVideos: false,
        blocksDocuments: false,
        note: null,
        blockedAt: null,
      });
    if (init?.method === "PATCH") return patch();
    return json(404, { error: "NotFound", code: "NOT_FOUND", message: "x" });
  });
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("VideosSection home-page toggle", () => {
  it("PATCHes showOnHomePage true when ticked, then reports the saved video", async () => {
    const saved = video({ showOnHomePage: true });
    api(() => json(200, saved));
    const { onUpdated } = renderVideos([video()]);

    expect(screen.getByText(HINT)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Show on our home page for Algebra",
      }),
    );

    await waitFor(() =>
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/tutors/me/videos/v-1"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ showOnHomePage: true }),
        }),
      ),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(saved));
    expect(toast.success).toHaveBeenCalledWith("Saved");
  });

  it("reverts the box and shows the error when the save fails", async () => {
    api(() => json(500, { error: "Internal", message: "Boom" }));
    renderVideos([video()]);

    const box = screen.getByRole("checkbox", {
      name: "Show on our home page for Algebra",
    });
    await userEvent.click(box);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't save that."),
    );
    expect(box).not.toBeChecked();
  });
});
