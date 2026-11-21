import type { ReactNode } from "react";
import { BlogMarkdown } from "@/components/blog/blog-markdown";
import { formatPostDate } from "@/lib/blog";
import type { SitePage } from "@/lib/site-content";

export function SitePageView({
  page,
  children,
}: {
  page: SitePage;
  children?: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col px-4 pt-[calc(var(--navbar-top-offset)+var(--navbar-height)+32px)] pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-4xl">
            {page.title}
          </h1>
          <p className="max-w-[65ch] text-lg text-pretty text-[var(--color-text-secondary)]">
            {page.description}
          </p>
        </header>

        {children && <div className="mt-8">{children}</div>}

        <div className="mt-8">
          <BlogMarkdown source={page.body} />
        </div>

        {page.updatedAt && (
          <p className="mt-10 text-sm text-[var(--color-text-secondary)]">
            Last updated{" "}
            <time dateTime={page.updatedAt} className="tabular-nums">
              {formatPostDate(page.updatedAt)}
            </time>
          </p>
        )}
      </div>
    </main>
  );
}
