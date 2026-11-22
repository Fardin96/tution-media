import { card } from "@/components/profile/styles";
import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the payment result (components/fees/payment-result-page.tsx): back link to the fee, then
// one centred outcome card with a status icon, a title, a line of copy and the reference.
export default function FeePaymentLoading() {
  return (
    <PageFrameSkeleton>
      <div className="grid gap-6">
        <Skeleton className="h-10 w-20 self-start" />

        <div
          aria-hidden="true"
          className={`${card} flex flex-col items-center gap-4 p-6 text-center sm:p-8`}
        >
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="h-6 w-56 max-w-full" />
          <div className="grid w-full max-w-md gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 justify-self-center" />
          </div>
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      </div>
    </PageFrameSkeleton>
  );
}
