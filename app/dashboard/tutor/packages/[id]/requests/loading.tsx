import { card } from "@/components/profile/styles";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors Package requests (components/packages/package-requests-page.tsx) in PageFrame: back link,
// the package header with its status, then request cards with their actions.
export default function PackageRequestsLoading() {
  return (
    <PageFrameSkeleton>
      <div className="grid gap-6">
        <Skeleton className="h-10 w-28 self-start" />

        <header className="grid gap-2">
          <Skeleton className="h-4 w-16" />
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-44 max-w-full" />
          <div className="grid gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </header>

        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className={`${card} flex flex-col gap-3 p-5`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid gap-2">
                  <Skeleton className="h-5 w-40 max-w-full" />
                  <Skeleton className="h-4 w-52 max-w-full" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-28 rounded-full" />
                <Skeleton className="h-10 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageFrameSkeleton>
  );
}
