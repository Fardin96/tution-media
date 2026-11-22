import { card } from "@/components/profile/styles";
import { RequirementShellSkeleton } from "@/components/requirements/requirement-shell-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors Requirement sets (components/tutor-requirements/tutor-requirements-page.tsx): the active
// count with New set, the Active and Archived tabs, then set cards in the ListingCard look.
export default function TutorRequirementsLoading() {
  return (
    <RequirementShellSkeleton>
      <div className="mt-8 flex flex-col gap-2">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="mt-auto pt-2">
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </RequirementShellSkeleton>
  );
}
