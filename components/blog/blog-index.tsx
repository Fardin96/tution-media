"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { card, focusRing, secondaryButton } from "@/components/profile/styles";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatPostDate,
  useBlogPosts,
  type BlogPostPage,
  type BlogPostSummary,
} from "@/lib/blog";
import { useRefreshExpiredMedia } from "@/lib/files";
import SpinnerEllipsis from "@/components/shadcn-space/spinner/spinner-05";

export function BlogIndex({ initialPage }: { initialPage?: BlogPostPage }) {
  const query = useBlogPosts(initialPage);
  const posts = query.data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <main className="flex flex-1 flex-col px-4 pt-[calc(var(--navbar-top-offset)+var(--navbar-height)+40px)] pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col">
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-4xl">
          Blog
        </h1>
        <p className="mt-2 max-w-prose text-pretty text-[var(--color-text-secondary)]">
          News and tips from Masters Hub.
        </p>

        <div className="mt-8">
          {query.isPending ? (
            <IndexSkeleton />
          ) : query.isError ? (
            <div
              className={cn(
                card,
                "flex flex-col items-center gap-3 p-6 text-center",
              )}
            >
              <p className="font-semibold text-[var(--color-neutral-charcoal)]">
                Couldn&apos;t load posts.
              </p>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className={secondaryButton}
              >
                Try again
              </button>
            </div>
          ) : posts.length === 0 ? (
            <p
              className={cn(
                card,
                "p-6 text-center text-[var(--color-text-secondary)]",
              )}
            >
              No posts yet.
            </p>
          ) : (
            <>
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <li key={post.slug}>
                    <PostCard post={post} />
                  </li>
                ))}
              </ul>
              {query.hasNextPage && (
                <div className="flex justify-center pt-10">
                  <button
                    type="button"
                    onClick={() => void query.fetchNextPage()}
                    disabled={query.isFetchingNextPage}
                    aria-busy={query.isFetchingNextPage || undefined}
                    className={secondaryButton}
                  >
                    {query.isFetchingNextPage ? (
                      <>
                        <SpinnerEllipsis />
                        Loading…
                      </>
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/** Cards in the grid's shape: cover, date, title and excerpt. */
function IndexSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading…</span>
      <ul
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        aria-hidden="true"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index}>
            <div
              className={cn(card, "flex h-full flex-col overflow-hidden p-2")}
            >
              <Skeleton className="aspect-[16/9] w-full rounded-[16px]" />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PostCard({ post }: { post: BlogPostSummary }) {
  const refreshExpired = useRefreshExpiredMedia();
  return (
    <Link
      href={`/blog/${encodeURIComponent(post.slug)}`}
      className={cn(
        card,
        "group flex h-full flex-col overflow-hidden p-2 transition-[box-shadow] duration-150 ease-out motion-reduce:transition-none",
        focusRing,
      )}
    >
      {post.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- R2 URLs are not configured for next/image.
        <img
          src={post.coverUrl}
          onError={refreshExpired}
          alt=""
          loading="lazy"
          className="aspect-[16/9] w-full rounded-[16px] object-cover outline outline-1 -outline-offset-1 outline-black/10"
        />
      ) : (
        <div
          aria-hidden="true"
          className="aspect-[16/9] w-full rounded-[16px] bg-[var(--color-secondary-sky)]"
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <time
          dateTime={post.publishedAt}
          className="text-xs font-medium text-[var(--color-text-secondary)] tabular-nums"
        >
          {formatPostDate(post.publishedAt)}
        </time>
        <h2 className="text-lg font-semibold text-balance text-[var(--color-neutral-charcoal)] group-hover:text-[var(--color-primary-deep)]">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="line-clamp-3 text-sm text-pretty text-[var(--color-text-secondary)]">
            {post.excerpt}
          </p>
        )}
      </div>
    </Link>
  );
}
