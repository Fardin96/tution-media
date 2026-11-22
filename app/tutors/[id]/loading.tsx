import { Skeleton } from "@/components/ui/skeleton";
import { TutorProfileSkeleton } from "@/components/tutor-profile/tutor-profile-page";

const WASH = [
  "radial-gradient(60% 50% at 10% 0%, color-mix(in oklab, var(--color-primary-core) 16%, transparent), transparent 70%)",
  "radial-gradient(50% 40% at 95% 10%, color-mix(in oklab, var(--color-mesh-glow) 45%, transparent), transparent 70%)",
  "radial-gradient(40% 40% at 80% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

// Shown at once on navigation, while page.tsx waits for the server. It mirrors PageFrame's layout
// (logo row, then the content column) so the swap does not jump. It reads no cookies, so it has no
// bell and no sign-in link.
export default function Loading() {
  return (
    <main
      className="relative isolate flex min-h-dvh flex-col bg-[var(--color-neutral-off-white)]"
      style={{ backgroundImage: WASH }}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <Skeleton className="h-10 w-40 sm:h-12 sm:w-48" />
        <Skeleton className="size-10 rounded-full" />
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <TutorProfileSkeleton />
        </div>
      </div>
    </main>
  );
}
