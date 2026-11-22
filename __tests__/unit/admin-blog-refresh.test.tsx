import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { refreshBlog } from "@/lib/blog.actions";
import {
  useCreateBlogPost,
  useDeleteBlogPost,
  useUpdateBlogPost,
  type AdminBlogPost,
} from "@/lib/admin-blog";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/blog.actions", () => ({ refreshBlog: vi.fn() }));

const post: AdminBlogPost = {
  id: "post-1",
  slug: "study-plans",
  title: "Study plans",
  excerpt: null,
  body: "Start with the syllabus.",
  status: "DRAFT",
  publishedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  authorId: "admin-1",
  authorName: "Farabi",
  cover: null,
};

function respond(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function signIn() {
  localStorage.setItem(
    "auth_tokens",
    JSON.stringify({ accessToken: "admin-token", refreshToken: "refresh" }),
  );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(refreshBlog).mockReset();
  vi.mocked(refreshBlog).mockResolvedValue(true);
  signIn();
});

afterEach(() => {
  localStorage.clear();
});

describe("admin blog writes refresh the public blog", () => {
  it("after a create", async () => {
    vi.mocked(apiFetch).mockResolvedValue(respond(post, 201));
    const { result } = renderHook(() => useCreateBlogPost(), {
      wrapper: wrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        title: "Study plans",
        slug: "study-plans",
        body: "Start with the syllabus.",
        status: "PUBLISHED",
      });
    });
    expect(refreshBlog).toHaveBeenCalledTimes(1);
    expect(refreshBlog).toHaveBeenCalledWith("admin-token");
  });

  it("after an update, which covers publish and archive", async () => {
    vi.mocked(apiFetch).mockResolvedValue(respond(post));
    const { result } = renderHook(() => useUpdateBlogPost("post-1"), {
      wrapper: wrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ status: "ARCHIVED" });
    });
    expect(refreshBlog).toHaveBeenCalledWith("admin-token");
  });

  it("after a delete", async () => {
    vi.mocked(apiFetch).mockResolvedValue(respond(null, 204));
    const { result } = renderHook(() => useDeleteBlogPost("post-1"), {
      wrapper: wrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(refreshBlog).toHaveBeenCalledWith("admin-token");
  });

  it("not after a failed write", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      respond({ code: "BLOG_SLUG_EXISTS", message: "Taken" }, 409),
    );
    const { result } = renderHook(() => useUpdateBlogPost("post-1"), {
      wrapper: wrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ slug: "taken" }),
      ).rejects.toBeDefined();
    });
    expect(refreshBlog).not.toHaveBeenCalled();
  });

  it("still reports the save when the refresh fails", async () => {
    vi.mocked(refreshBlog).mockRejectedValue(new Error("API down"));
    vi.mocked(apiFetch).mockResolvedValue(respond(post));
    const { result } = renderHook(() => useUpdateBlogPost("post-1"), {
      wrapper: wrapper(),
    });

    let saved: AdminBlogPost | undefined;
    await act(async () => {
      saved = await result.current.mutateAsync({ title: "Study plans" });
    });
    expect(saved).toEqual(post);
    expect(result.current.isError).toBe(false);
  });

  it("skips the refresh when no admin is signed in", async () => {
    localStorage.clear();
    vi.mocked(apiFetch).mockResolvedValue(respond(post));
    const { result } = renderHook(() => useUpdateBlogPost("post-1"), {
      wrapper: wrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: "Study plans" });
    });
    expect(refreshBlog).not.toHaveBeenCalled();
  });
});
