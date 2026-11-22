import { card } from "@/components/profile/styles";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the package detail (components/browse/package-detail-page.tsx): back link, title and
// description, then Package details rows beside the tutor and request card.
export default function PackageDetailLoading() {
  return (
    <PageFrameSkeleton>
      <Skeleton className="h-10 w-28 self-start" />

      <Skeleton className="mt-4 h-8 w-64 max-w-full" />
      <div className="mt-2 grid max-w-prose gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div aria-hidden="true" className={`${card} grid gap-5 p-5 sm:p-6`}>
          <Skeleton className="h-5 w-40 max-w-full" />
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid gap-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-28 max-w-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div aria-hidden="true" className={`${card} grid gap-4 p-5`}>
            <Skeleton className="h-4 w-16" />
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="grid gap-2">
                <Skeleton className="h-5 w-36 max-w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
          <div aria-hidden="true" className={`${card} grid gap-4 p-5`}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        </div>
      </div>
    </PageFrameSkeleton>
  );
}
