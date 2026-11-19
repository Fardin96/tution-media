import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";
import { ApiError } from "./profile";

// Public blog reads (no sign-in needed). Shapes come from lib/api-types.ts.
export type BlogPostSummary = Schemas["BlogPostSummary"];
export type BlogPost = Schemas["BlogPost"];

export const blogApi = {
  list: (cursor?: string) =>
    unwrap(client.GET("/api/v1/blog", { params: { query: { cursor } } })),
  get: (slug: string) =>
    unwrap(client.GET("/api/v1/blog/{slug}", { params: { path: { slug } } })),
};

export function useBlogPosts() {
  return useInfiniteQuery({
    queryKey: queryKeys.blog.list,
    queryFn: ({ pageParam }) => blogApi.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useBlogPost(slug: string) {
  return useQuery({
    queryKey: queryKeys.blog.post(slug),
    queryFn: () => blogApi.get(slug),
    // A missing or draft post is final; only server and network errors are retried.
    retry: (failureCount, err) =>
      failureCount < 2 &&
      !(err instanceof ApiError && err.status >= 400 && err.status < 500),
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
