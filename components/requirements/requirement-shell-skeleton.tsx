import type * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Outer markup copied from RequirementPageShell (components/requirements/requirement-page-shell.tsx).
// Keep the two in step.
const WASH = [
  "radial-gradient(60% 50% at 10% 0%, color-mix(in oklab, var(--color-primary-core) 16%, transparent), transparent 70%)",
  "radial-gradient(50% 40% at 95% 10%, color-mix(in oklab, var(--color-mesh-glow) 45%, transparent), transparent 70%)",
  "radial-gradient(40% 40% at 80% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

function FormBody() {
  return (
    <div className="mt-8 grid gap-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-4 w-28 max-w-full" />
          <Skeleton className="h-11 w-full rounded-[14px]" />
        </div>
      ))}
      <Skeleton className="h-11 w-36 rounded-full" />
    </div>
  );
}

/**
 * Loading shell for pages built on RequirementPageShell: the logo, the back link spot, the eyebrow,
 * title and description, then the body. The body defaults to a form (four fields and a button);
 * list pages pass their own skeleton as `children`.
 */
export function RequirementShellSkeleton({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <main
      className="relative isolate flex min-h-dvh flex-col bg-[var(--color-neutral-off-white)]"
      style={{ backgroundImage: WASH }}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6 sm:px-6">
        <Skeleton className="aspect-[860/220] h-10 sm:h-12" />
      </header>

      <div
        role="status"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12"
      >
        <span className="sr-only">Loading…</span>
        <div className="mb-4 flex">
          <Skeleton className="h-10 w-28 justify-self-start" />
        </div>
        <Skeleton className="h-4 w-36 max-w-full" />
        <Skeleton className="mt-2 h-8 w-56 max-w-full" />
        <div className="mt-2 grid gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {children ?? <FormBody />}
      </div>
    </main>
  );
}
