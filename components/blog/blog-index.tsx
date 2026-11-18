"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { card, focusRing, secondaryButton } from "@/components/profile/styles";
import { Footer } from "@/components/footer";
import { formatPostDate, useBlogPosts, type BlogPostSummary } from "@/lib/blog";

export function BlogIndex() {
  const query = useBlogPosts();
  const posts = query.data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <>
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
              <p
                role="status"
                className="text-sm text-[var(--color-text-secondary)]"
              >
                Loading posts...
              </p>
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
                      {query.isFetchingNextPage ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function PostCard({ post }: { post: BlogPostSummary }) {
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
