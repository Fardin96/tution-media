import type { ReactNode } from "react";
import { card } from "@/components/profile/styles";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the placement fee detail (components/fees/fee-detail-page.tsx): back link, eyebrow and
// student name, then a Summary of label and value rows, a payment section and the payments ledger.
function SectionSkeleton({
  titleWidth,
  children,
}: {
  titleWidth: string;
  children: ReactNode;
}) {
  return (
    <div aria-hidden="true" className={`${card} grid gap-5 p-5`}>
      <Skeleton className={`h-5 ${titleWidth} max-w-full`} />
      {children}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="grid gap-1 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-4 w-28 max-w-full" />
    </div>
  );
}

export default function FeeDetailLoading() {
  return (
    <PageFrameSkeleton>
      <div className="grid gap-6">
        <Skeleton className="h-10 w-20 self-start" />

        <header className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-56 max-w-full" />
        </header>

        <SectionSkeleton titleWidth="w-20">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-28">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-11 w-44 rounded-full" />
        </SectionSkeleton>

        <SectionSkeleton titleWidth="w-24">
          <div className="grid gap-3">
            <Skeleton className="h-14 w-full rounded-[16px]" />
            <Skeleton className="h-14 w-full rounded-[16px]" />
          </div>
        </SectionSkeleton>
      </div>
    </PageFrameSkeleton>
  );
}
