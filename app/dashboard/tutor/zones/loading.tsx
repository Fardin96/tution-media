import { card } from "@/components/profile/styles";
import { Skeleton } from "@/components/ui/skeleton";

// Outer markup copied from Teaching zones (components/tutor-zones/tutor-zones-page.tsx), which has
// its own frame: logo only in the header, a 5xl content column. Keep the two in step.
const WASH = [
  "radial-gradient(60% 50% at 10% 0%, color-mix(in oklab, var(--color-primary-core) 16%, transparent), transparent 70%)",
  "radial-gradient(50% 40% at 95% 10%, color-mix(in oklab, var(--color-mesh-glow) 45%, transparent), transparent 70%)",
  "radial-gradient(40% 40% at 80% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

// Mirrors Teaching zones: the usage meter, then the map beside the zone list.
export default function TutorZonesLoading() {
  return (
    <main
      className="relative isolate flex min-h-dvh flex-col bg-[var(--color-neutral-off-white)]"
      style={{ backgroundImage: WASH }}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6 sm:px-6">
        <Skeleton className="h-10 w-40 sm:h-12 sm:w-48" />
      </header>

      <div
        role="status"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12"
      >
        <span className="sr-only">Loading…</span>
        <div className="mb-4 flex">
          <Skeleton className="h-10 w-28 justify-self-start" />
        </div>
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-2 w-48 max-w-full rounded-full" />
        </div>

        <div className="@container mt-8">
          <div className="grid gap-6 @min-[52rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Skeleton className="h-72 rounded-[24px] @min-[52rem]:h-auto @min-[52rem]:min-h-[28rem]" />
            <div aria-hidden="true" className={`${card} grid gap-4 p-5`}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
                >
                  <Skeleton className="h-5 w-40 max-w-full" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
