import { card } from "@/components/profile/styles";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors Reports and disputes (components/cases/reports-page.tsx): back link, title and intro,
// then the Disputes and Reports groups of case rows.
function CaseSkeleton() {
  return (
    <div aria-hidden="true" className={`${card} grid gap-3 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <Skeleton className="h-5 w-44 max-w-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-64 max-w-full" />
      <div className="grid gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

export default function ReportsLoading() {
  return (
    <PageFrameSkeleton>
      <div className="grid gap-8">
        <div className="grid gap-6">
          <Skeleton className="h-10 w-28 self-start" />
          <div className="grid gap-2">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
        </div>

        <div className="grid gap-3">
          <Skeleton className="h-5 w-24" />
          <CaseSkeleton />
          <CaseSkeleton />
        </div>

        <div className="grid gap-3">
          <Skeleton className="h-5 w-20" />
          <CaseSkeleton />
        </div>
      </div>
    </PageFrameSkeleton>
  );
}
