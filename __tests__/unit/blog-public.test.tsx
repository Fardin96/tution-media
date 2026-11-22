import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import {
  getBlogFirstPage,
  getBlogPost,
  useBlogPost,
  useBlogPosts,
  type BlogPost,
  type BlogPostPage,
} from "@/lib/blog";
import { publicApiGet } from "@/lib/server-fetch";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/server-fetch", () => ({ publicApiGet: vi.fn() }));

const PUBLISHED = "2026-11-01T00:00:00.000Z";

const page: BlogPostPage = {
  posts: [
    {
      slug: "first-post",
      title: "First post",
      excerpt: "Hello",
      publishedAt: PUBLISHED,
      coverUrl: null,
    },
  ],
  nextCursor: "cursor-2",
};

const post: BlogPost = {
  slug: "first-post",
  title: "First post",
  excerpt: "Hello",
  body: "The body.",
  publishedAt: PUBLISHED,
  updatedAt: PUBLISHED,
  coverUrl: null,
};

/** Matches the app's QueryClient defaults (app/providers.tsx): fresh for 60 s. */
function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(publicApiGet).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useBlogPosts", () => {
  it("shows the server's first page without a request", () => {
    const { result } = renderHook(() => useBlogPosts(page), {
      wrapper: wrapper(),
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data?.pages).toEqual([page]);
    expect(result.current.hasNextPage).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("fetches the first page when no initial page is given", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(page));
    const { result } = renderHook(() => useBlogPosts(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toEqual([page]);
    expect(String(vi.mocked(apiFetch).mock.calls[0][0])).toContain(
      "/api/v1/blog",
    );
  });
});

describe("useBlogPost", () => {
  it("shows the server's post without a request", () => {
    const { result } = renderHook(() => useBlogPost("first-post", post), {
      wrapper: wrapper(),
    });

    expect(result.current.data).toEqual(post);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("fetches the post when no initial post is given", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(post));
    const { result } = renderHook(() => useBlogPost("first-post"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(apiFetch).mock.calls[0][0])).toContain(
      "/api/v1/blog/first-post",
    );
  });
});

describe("server reads", () => {
  it("asks for the first page with the public 5-minute revalidate and the blog tag", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: true, data: page });

    await expect(getBlogFirstPage()).resolves.toEqual({ ok: true, data: page });
    expect(publicApiGet).toHaveBeenCalledWith("/api/v1/blog", {
      revalidate: 300,
      tags: ["blog"],
    });
  });

  it("encodes the slug and tags the post by slug and by blog", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: true, data: post });

    await getBlogPost("odd/slug");
    expect(publicApiGet).toHaveBeenCalledWith("/api/v1/blog/odd%2Fslug", {
      revalidate: 300,
      tags: ["blog", "blog:odd/slug"],
    });
  });
});
