import type { ReactNode } from "react";
import { card } from "@/components/profile/styles";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the application detail (components/applications/application-detail-page.tsx): back link,
// heading with the status pill, then Tuition, Timeline and Contact sections of summary rows.
function SectionSkeleton({
  titleWidth,
  children,
}: {
  titleWidth: string;
  children: ReactNode;
}) {
  return (
    <div aria-hidden="true" className={`${card} p-5`}>
      <Skeleton className={`h-5 ${titleWidth} max-w-full`} />
      <div className="mt-3">{children}</div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-32 max-w-full" />
    </div>
  );
}

export default function ApplicationDetailLoading() {
  return (
    <PageFrameSkeleton>
      <div className="grid gap-6">
        <Skeleton className="h-10 w-28 self-start" />

        <header className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid min-w-0 gap-2">
              <Skeleton className="h-8 w-56 max-w-full" />
              <Skeleton className="h-4 w-40 max-w-full" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </header>

        <SectionSkeleton titleWidth="w-20">
          <div className="grid gap-3 sm:grid-cols-2">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-24">
          <div className="grid gap-3 sm:grid-cols-3">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-20">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-32 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </SectionSkeleton>
      </div>
    </PageFrameSkeleton>
  );
}
