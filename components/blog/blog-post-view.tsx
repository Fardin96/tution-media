"use client";

import { BackLink } from "@/components/ui/back-link";
import { Footer } from "@/components/footer";
import { BlogMarkdown } from "@/components/blog/blog-markdown";
import { cn } from "@/lib/utils";
import { secondaryButton } from "@/components/profile/styles";
import { ApiError } from "@/lib/profile";
import { formatPostDate, useBlogPost } from "@/lib/blog";
import { useRefreshExpiredMedia } from "@/lib/files";

export function BlogPostView({ slug }: { slug: string }) {
  const refreshExpired = useRefreshExpiredMedia();
  const query = useBlogPost(slug);
  const post = query.data;
  const notFound =
    query.error instanceof ApiError && query.error.status === 404;

  return (
    <>
      <main className="flex flex-1 flex-col px-4 pt-[calc(var(--navbar-top-offset)+var(--navbar-height)+32px)] pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          <BackLink href="/blog">Blog</BackLink>

          {query.isPending ? (
            <p
              role="status"
              className="mt-8 text-sm text-[var(--color-text-secondary)]"
            >
              Loading post...
            </p>
          ) : notFound ? (
            <div className="mt-8 flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)]">
                We couldn&apos;t find that post.
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                It may have been moved or unpublished. Check the link, or read
                the other posts on the blog.
              </p>
            </div>
          ) : query.isError ? (
            <div className="mt-8 flex flex-col items-start gap-3">
              <p className="font-semibold text-[var(--color-neutral-charcoal)]">
                Couldn&apos;t load this post.
              </p>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className={secondaryButton}
              >
                Try again
              </button>
            </div>
          ) : post ? (
            <article className="mt-6 flex flex-col">
              <header className="flex flex-col gap-3">
                <time
                  dateTime={post.publishedAt}
                  className="text-sm font-medium text-[var(--color-text-secondary)] tabular-nums"
                >
                  {formatPostDate(post.publishedAt)}
                </time>
                <h1 className="text-3xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-4xl">
                  {post.title}
                </h1>
                {post.excerpt && (
                  <p className="max-w-[65ch] text-lg text-pretty text-[var(--color-text-secondary)]">
                    {post.excerpt}
                  </p>
                )}
              </header>

              {post.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- R2 URLs are not configured for next/image.
                <img
                  src={post.coverUrl}
                  onError={refreshExpired}
                  alt=""
                  className={cn(
                    "mt-8 aspect-[16/9] w-full rounded-[24px] object-cover outline outline-1 -outline-offset-1 outline-black/10",
                  )}
                />
              )}

              <div className="mt-8">
                <BlogMarkdown source={post.body} />
              </div>
            </article>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}
