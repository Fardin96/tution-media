import { card } from "@/components/profile/styles";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors OnboardingWizard (components/profile/onboarding-wizard.tsx): the logo and sign-out row,
// then the centred column with the eyebrow, title, four step bars, and the form card.
const WASH = [
  "radial-gradient(60% 50% at 10% 0%, color-mix(in oklab, var(--color-primary-core) 16%, transparent), transparent 70%)",
  "radial-gradient(50% 40% at 95% 10%, color-mix(in oklab, var(--color-mesh-glow) 45%, transparent), transparent 70%)",
  "radial-gradient(40% 40% at 80% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

// Student and tutor both have four steps (three sections plus the phone verify step).
const STEP_COUNT = 4;

export default function OnboardingLoading() {
  return (
    <div
      role="status"
      className="relative isolate flex min-h-dvh flex-col bg-[var(--color-neutral-off-white)]"
      style={{ backgroundImage: WASH }}
    >
      <span className="sr-only">Loading…</span>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6 sm:px-6">
        <Skeleton className="h-10 w-40 sm:h-12 sm:w-48" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-1 h-8 w-64 max-w-full sm:h-10" />

        <div
          className="mt-6 grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${STEP_COUNT}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-1.5 rounded-full" />
              <Skeleton className="h-4 w-12 max-w-full" />
            </div>
          ))}
        </div>

        <div
          aria-hidden="true"
          className={cn(card, "mt-6 grid gap-5 p-5 sm:p-8")}
        >
          {[0, 1].map((i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full rounded-[12px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
