import { card } from "@/components/profile/styles";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors Find tuitions (components/browse/find-tuitions-page.tsx) in PageFrame: header action,
// back link, title and intro, the filter card (scope control and selects), then tuition cards.
export default function FindTuitionsLoading() {
  return (
    <PageFrameSkeleton hasAction>
      <Skeleton className="h-10 w-28 self-start" />

      <Skeleton className="mt-6 h-8 w-56 max-w-full" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />

      <section
        aria-hidden="true"
        className={`${card} mt-6 grid gap-5 p-5 sm:p-6`}
      >
        <div className="grid gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full max-w-md rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full rounded-[14px]" />
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} aria-hidden="true" className={`${card} grid gap-4 p-5`}>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-3/4 max-w-full" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="grid gap-1">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
            <Skeleton className="h-4 w-44 max-w-full" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </PageFrameSkeleton>
  );
}
