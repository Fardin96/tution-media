import { card } from "@/components/profile/styles";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the applications list (components/applications/applications-page.tsx) in PageFrame:
// the header action, back link, title, status filter chips and application cards.
export default function ApplicationsLoading() {
  return (
    <PageFrameSkeleton hasAction>
      <Skeleton className="h-10 w-28 self-start" />

      <Skeleton className="mt-6 h-8 w-56 max-w-full" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-16 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
        <Skeleton className="h-4 w-36" />
      </div>

      <div className="mt-4 grid gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className={`${card} flex flex-col gap-4 p-5`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="grid gap-2">
                <Skeleton className="h-5 w-44 max-w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </PageFrameSkeleton>
  );
}
