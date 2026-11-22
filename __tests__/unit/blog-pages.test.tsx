import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import BlogPage from "@/app/(site)/blog/page";
import BlogPostPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/(site)/blog/[slug]/page";
import type { BlogPost, BlogPostPage as BlogPostPageData } from "@/lib/blog";
import { publicApiGet } from "@/lib/server-fetch";

vi.mock("@/lib/server-fetch", () => ({ publicApiGet: vi.fn() }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const PUBLISHED = "2026-11-01T00:00:00.000Z";

const list: BlogPostPageData = {
  posts: [
    {
      slug: "first-post",
      title: "First post",
      excerpt: "Hello",
      publishedAt: PUBLISHED,
      coverUrl: null,
    },
    {
      slug: "second-post",
      title: "Second post",
      excerpt: null,
      publishedAt: PUBLISHED,
      coverUrl: null,
    },
  ],
  nextCursor: null,
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

type Tree = ReactElement<{ children: ReactElement<Record<string, unknown>>[] }>;

beforeEach(() => {
  vi.mocked(publicApiGet).mockReset();
  vi.mocked(notFound).mockClear();
});

describe("/blog", () => {
  it("passes the server's first page to the index", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: true, data: list });
    const tree = (await BlogPage()) as Tree;
    expect(tree.props.children[0].props.initialPage).toEqual(list);
  });

  it("passes no initial page when the request fails", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: false, status: 500 });
    const tree = (await BlogPage()) as Tree;
    expect(tree.props.children[0].props.initialPage).toBeUndefined();
  });
});

describe("generateStaticParams", () => {
  it("returns the slugs of the first page", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: true, data: list });
    await expect(generateStaticParams()).resolves.toEqual([
      { slug: "first-post" },
      { slug: "second-post" },
    ]);
  });

  it("returns no params when the API is unavailable", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: false, status: null });
    await expect(generateStaticParams()).resolves.toEqual([]);
  });

  it("returns no params when the request throws", async () => {
    vi.mocked(publicApiGet).mockRejectedValue(new Error("boom"));
    await expect(generateStaticParams()).resolves.toEqual([]);
  });
});

describe("generateMetadata", () => {
  const params = Promise.resolve({ slug: "first-post" });

  it("uses the post's title and excerpt", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: true, data: post });
    await expect(generateMetadata({ params })).resolves.toEqual({
      title: "First post · Masters Hub",
      description: "Hello",
    });
  });

  it("leaves the description out when the post has no excerpt", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({
      ok: true,
      data: { ...post, excerpt: null },
    });
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe("First post · Masters Hub");
    expect(meta.description).toBeUndefined();
  });

  it("falls back to the blog title when the post is not available", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: false, status: 404 });
    await expect(generateMetadata({ params })).resolves.toEqual({
      title: "Blog · Masters Hub",
    });
  });
});

describe("/blog/[slug]", () => {
  const params = Promise.resolve({ slug: "first-post" });

  it("passes the server's post to the view", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: true, data: post });
    const tree = (await BlogPostPage({ params })) as Tree;
    expect(tree.props.children[0].props.initialPost).toEqual(post);
    expect(tree.props.children[0].props.slug).toBe("first-post");
  });

  it("renders the client fallback when the API cannot answer", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: false, status: null });
    const tree = (await BlogPostPage({ params })) as Tree;
    expect(tree.props.children[0].props.initialPost).toBeUndefined();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("answers with not found for a missing or unpublished post", async () => {
    vi.mocked(publicApiGet).mockResolvedValue({ ok: false, status: 404 });
    await expect(BlogPostPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
