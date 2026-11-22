import { card } from "@/components/profile/styles";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Renders inside AdminShell's content column (layout.tsx), so this draws only the page: the back
// link, the title block, a chip row and cards. Spacing matches AdminPage in components/admin/admin-ui.tsx.
export default function AdminLoading() {
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">Loading…</span>

      <div className="mb-4 flex">
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-64">
          <Skeleton className="h-8 w-56 max-w-full sm:h-9" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="-mx-4 flex gap-2 px-4 sm:mx-0 sm:px-0">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(card, "flex flex-col gap-3 p-5 sm:p-6")}
          >
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
