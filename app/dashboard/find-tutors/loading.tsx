import { card } from "@/components/profile/styles";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors Find tutors (components/browse/find-tutors-page.tsx) in PageFrame: header action, back
// link, title and intro, the Tutors / Packages tab track, then tutor result cards.
export default function FindTutorsLoading() {
  return (
    <PageFrameSkeleton hasAction>
      <Skeleton className="h-10 w-28 self-start" />

      <Skeleton className="mt-4 h-8 w-44 max-w-full" />
      <Skeleton className="mt-2 h-4 w-56 max-w-full" />

      <div className="mt-6 grid gap-6">
        <div className="flex gap-2 rounded-full bg-[var(--color-neutral-white)] p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>

        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className={`${card} flex flex-col gap-4 p-5`}
            >
              <div className="grid gap-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 shrink-0 rounded-full" />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <Skeleton className="h-5 w-36 max-w-full" />
                    <Skeleton className="h-4 w-20 shrink-0" />
                  </div>
                </div>
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageFrameSkeleton>
  );
}
