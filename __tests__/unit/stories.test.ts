import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, getStoredTokens } from "@/lib/api";
import { refreshSiteContentForUser } from "@/lib/site-content.actions";
import {
  blockedText,
  STORY_STATUS,
  storyTitle,
  useDeleteStory,
  validateStoryForm,
  type StoryForm,
} from "@/lib/stories";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
  getStoredTokens: vi.fn(),
}));

vi.mock("@/lib/site-content.actions", () => ({
  refreshSiteContentForUser: vi.fn(),
}));

const consented: StoryForm = {
  headline: "Ana passed her SSC with A+",
  body: "We met twice a week for maths.",
  imageFileId: null,
  videoFileId: null,
  consent: true,
};

const student = (over: Partial<StoryForm> = {}) => ({ ...consented, ...over });

const words = (n: number) => Array.from({ length: n }, () => "a").join(" ");

describe("validateStoryForm for students", () => {
  it("accepts a filled form with consent", () => {
    expect(validateStoryForm("STUDENT", consented)).toEqual({});
  });

  it("requires a headline", () => {
    expect(validateStoryForm("STUDENT", student({ headline: "  " }))).toEqual({
      headline: "Enter a headline.",
    });
  });

  it("keeps the headline to one line", () => {
    expect(
      validateStoryForm("STUDENT", student({ headline: "Two\nlines" })),
    ).toEqual({ headline: "Keep the headline to one line." });
  });

  it("allows 85 characters in the headline and refuses 86", () => {
    expect(
      validateStoryForm("STUDENT", student({ headline: "h".repeat(85) })),
    ).toEqual({});
    expect(
      validateStoryForm("STUDENT", student({ headline: "h".repeat(86) })),
    ).toEqual({ headline: "Keep it to 85 characters or fewer." });
  });

  it("requires a body", () => {
    expect(validateStoryForm("STUDENT", student({ body: " " }))).toEqual({
      body: "Write your story.",
    });
  });

  it("allows 700 characters in the body and refuses 701", () => {
    expect(
      validateStoryForm("STUDENT", student({ body: "x".repeat(700) })),
    ).toEqual({});
    expect(
      validateStoryForm("STUDENT", student({ body: "x".repeat(701) })),
    ).toEqual({ body: "Keep it to 700 characters or fewer." });
  });

  it("allows 90 words in the body and refuses 91", () => {
    expect(validateStoryForm("STUDENT", student({ body: words(90) }))).toEqual(
      {},
    );
    expect(validateStoryForm("STUDENT", student({ body: words(91) }))).toEqual({
      body: "Keep it to 90 words or fewer.",
    });
  });

  it("requires consent", () => {
    expect(validateStoryForm("STUDENT", student({ consent: false }))).toEqual({
      consent: "Tick the box to agree before sending.",
    });
  });
});

describe("validateStoryForm for tutors", () => {
  it("ignores the headline, which tutors do not send", () => {
    expect(
      validateStoryForm("TUTOR", {
        ...consented,
        headline: "",
        body: "I teach maths.",
      }),
    ).toEqual({});
  });

  it("allows 300 characters in the body and refuses 301", () => {
    expect(
      validateStoryForm("TUTOR", { ...consented, body: "x".repeat(300) }),
    ).toEqual({});
    expect(
      validateStoryForm("TUTOR", { ...consented, body: "x".repeat(301) }),
    ).toEqual({
      body: "Keep it to 300 characters or fewer.",
    });
  });

  it("does not apply the student word limit", () => {
    expect(
      validateStoryForm("TUTOR", { ...consented, body: words(120) }),
    ).toEqual({});
  });

  it("still requires consent", () => {
    expect(
      validateStoryForm("TUTOR", { ...consented, consent: false }),
    ).toEqual({
      consent: "Tick the box to agree before sending.",
    });
  });
});

describe("blockedText", () => {
  it("names the limit with the given maximum", () => {
    expect(blockedText("LIMIT", 3)).toBe(
      "You have 3 stories, the most allowed. Delete one to send another.",
    );
  });

  it("explains a pending review", () => {
    expect(blockedText("PENDING", 3)).toBe(
      "Your story is waiting for review. You can send another once it's reviewed.",
    );
  });

  it("is null when a story can be sent", () => {
    expect(blockedText(null, 3)).toBeNull();
  });
});

describe("STORY_STATUS and storyTitle", () => {
  it("labels each status with its tone", () => {
    expect(STORY_STATUS.PENDING).toEqual({
      label: "Waiting for review",
      tone: "warning",
    });
    expect(STORY_STATUS.APPROVED).toEqual({
      label: "Approved",
      tone: "success",
    });
    expect(STORY_STATUS.REJECTED).toEqual({
      label: "Not approved",
      tone: "error",
    });
  });

  it("uses the headline, or the first line of the body for tutors", () => {
    expect(storyTitle({ headline: "Ana passed", body: "Long text" })).toBe(
      "Ana passed",
    );
    expect(
      storyTitle({ headline: null, body: "First line\nSecond line" }),
    ).toBe("First line");
  });
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function renderDelete() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  }
  return renderHook(() => useDeleteStory(), { wrapper: Wrapper });
}

describe("useDeleteStory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStoredTokens).mockReturnValue({
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 204 }));
    vi.mocked(refreshSiteContentForUser).mockResolvedValue(true);
  });

  it("expires the landing cache with the signed-in token once the story is withdrawn", async () => {
    const { result } = renderDelete();

    await act(() => result.current.mutateAsync("story-1"));

    await waitFor(() =>
      expect(refreshSiteContentForUser).toHaveBeenCalledWith("access-1"),
    );
  });

  it("does not touch the landing when nobody is signed in", async () => {
    vi.mocked(getStoredTokens).mockReturnValue(null);
    const { result } = renderDelete();

    await act(() => result.current.mutateAsync("story-1"));

    expect(refreshSiteContentForUser).not.toHaveBeenCalled();
  });

  it("does not touch the landing when the delete fails", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(404, { error: "Not found" }));
    const { result } = renderDelete();

    await act(async () => {
      await expect(result.current.mutateAsync("story-1")).rejects.toBeDefined();
    });

    expect(refreshSiteContentForUser).not.toHaveBeenCalled();
  });

  it("still reports the delete as done when the landing refresh fails", async () => {
    vi.mocked(refreshSiteContentForUser).mockRejectedValue(
      new TypeError("fetch failed"),
    );
    const { result } = renderDelete();

    await act(async () => {
      await expect(
        result.current.mutateAsync("story-1"),
      ).resolves.toBeUndefined();
    });
    await waitFor(() =>
      expect(refreshSiteContentForUser).toHaveBeenCalledTimes(1),
    );
  });
});
