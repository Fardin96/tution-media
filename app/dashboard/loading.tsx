import { card } from "@/components/profile/styles";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors the signed-in dashboard (ProfileDashboard in components/profile/profile-dashboard.tsx):
// the sticky top bar, the washed hero, then the content column. Every /dashboard page renders its
// own chrome, so this frame shows while any of them streams in.
const WASH = [
  "radial-gradient(55% 80% at 0% 0%, color-mix(in oklab, var(--color-primary-core) 18%, transparent), transparent 70%)",
  "radial-gradient(45% 70% at 100% 0%, color-mix(in oklab, var(--color-mesh-glow) 50%, transparent), transparent 70%)",
  "radial-gradient(40% 60% at 70% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

export default function DashboardLoading() {
  return (
    <div
      role="status"
      className="min-h-dvh bg-[var(--color-neutral-off-white)]"
    >
      <span className="sr-only">Loading…</span>

      <header className="sticky top-0 z-40 bg-[color-mix(in_oklab,var(--color-neutral-white)_85%,transparent)] shadow-[0_1px_0_rgb(0_0_0/0.06)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Skeleton className="aspect-[860/220] h-9" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </div>
      </header>

      <div
        className="relative isolate overflow-hidden"
        style={{ backgroundImage: WASH }}
      >
        <div className="mx-auto grid w-full max-w-6xl gap-3 px-4 pt-8 pb-10 sm:px-6 sm:pt-12">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(card, "grid gap-3 rounded-[20px] p-5 sm:p-6")}
          >
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </main>
    </div>
  );
}
