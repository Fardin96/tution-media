import { card } from "@/components/profile/styles";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the placement fees list (components/fees/fees-page.tsx): back link, title and intro,
// then fee cards with three figures and a payment button.
export default function FeesLoading() {
  return (
    <PageFrameSkeleton>
      <div className="grid gap-6">
        <Skeleton className="h-10 w-28 self-start" />

        <div className="grid gap-2">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>

        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className={`${card} grid gap-4 p-5`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-2">
                  <Skeleton className="h-5 w-40 max-w-full" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="grid gap-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </PageFrameSkeleton>
  );
}
