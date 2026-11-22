import {
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";
import { ApiError } from "./profile";
import { publicApiGet } from "./server-fetch";

// Public blog reads (no sign-in needed). Shapes come from lib/api-types.ts.
export type BlogPostSummary = Schemas["BlogPostSummary"];
export type BlogPost = Schemas["BlogPost"];
export type BlogPostPage = Schemas["BlogPostPage"];

export const blogApi = {
  list: (cursor?: string) =>
    unwrap(client.GET("/api/v1/blog", { params: { query: { cursor } } })),
  get: (slug: string) =>
    unwrap(client.GET("/api/v1/blog/{slug}", { params: { path: { slug } } })),
};

/**
 * The first page is rendered on the server (see the blog pages), so it arrives as
 * `initialPage`. Later pages are fetched in the browser.
 */
export function useBlogPosts(initialPage?: BlogPostPage) {
  return useInfiniteQuery({
    queryKey: queryKeys.blog.list,
    queryFn: ({ pageParam }) => blogApi.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: initialPage
      ? { pages: [initialPage], pageParams: [undefined] }
      : undefined,
  });
}

export const blogPostQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.blog.post(slug),
    queryFn: () => blogApi.get(slug),
    // A missing or draft post is final; only server and network errors are retried.
    retry: (failureCount: number, err: Error) =>
      failureCount < 2 &&
      !(err instanceof ApiError && err.status >= 400 && err.status < 500),
  });

export function useBlogPost(slug: string, initialPost?: BlogPost) {
  return useQuery({
    ...blogPostQueryOptions(slug),
    initialData: initialPost,
  });
}

/* ───────── Server reads (prerender and ISR) ───────── */

// Matches the API's public max-age. Admin saves expire the "blog" tag at once.
const BLOG_REVALIDATE_SECONDS = 300;

/**
 * The first page of posts, the same request the client's first page makes. Anonymous, so the
 * result is the same for every visitor and safe to cache.
 */
export function getBlogFirstPage() {
  return publicApiGet<BlogPostPage>("/api/v1/blog", {
    revalidate: BLOG_REVALIDATE_SECONDS,
    tags: ["blog"],
  });
}

/** One published post by slug. Drafts and archived posts answer 404. */
export function getBlogPost(slug: string) {
  return publicApiGet<BlogPost>(`/api/v1/blog/${encodeURIComponent(slug)}`, {
    revalidate: BLOG_REVALIDATE_SECONDS,
    tags: ["blog", `blog:${slug}`],
  });
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

/** "12 Nov 2026" in Dhaka time, for post dates. */
export function formatPostDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}
