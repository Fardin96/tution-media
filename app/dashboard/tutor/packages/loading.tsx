import { card } from "@/components/profile/styles";
import { RequirementShellSkeleton } from "@/components/requirements/requirement-shell-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors Your packages (components/packages/my-packages-page.tsx): the count with New package,
// then package cards in the ListingCard look (icon tile, status, title, body, footer).
export default function TutorPackagesLoading() {
  return (
    <RequirementShellSkeleton>
      <div className="mt-8 flex min-h-11 flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-36 rounded-full" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className={`${card} flex h-full flex-col gap-3 p-5`}
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="size-11 shrink-0 rounded-[14px]" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-5 w-3/4 max-w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 pt-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </RequirementShellSkeleton>
  );
}
