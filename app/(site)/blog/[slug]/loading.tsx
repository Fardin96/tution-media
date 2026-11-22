import { Skeleton } from "@/components/ui/skeleton";

// Shown while a post is fetched on navigation. Same frame as BlogPostView so nothing jumps.
export default function Loading() {
  return (
    <main className="flex flex-1 flex-col px-4 pt-[calc(var(--navbar-top-offset)+var(--navbar-height)+32px)] pb-16 sm:px-6 lg:px-8">
      <div role="status" className="mx-auto flex w-full max-w-3xl flex-col">
        <span className="sr-only">Loading…</span>
        <div aria-hidden="true" className="flex flex-col">
          <Skeleton className="h-9 w-20" />
          <article className="mt-6 flex flex-col">
            <header className="flex flex-col gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full sm:h-12" />
              <Skeleton className="h-10 w-3/4 sm:h-12" />
              <Skeleton className="mt-1 h-5 w-full max-w-[65ch]" />
            </header>
            <Skeleton className="mt-8 aspect-[16/9] w-full rounded-[24px]" />
            <div className="mt-8 flex flex-col gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
