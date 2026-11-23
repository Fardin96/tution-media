import type * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Outer markup copied from PageFrame (components/ui/page-frame.tsx). Keep the two in step.
const WASH = [
  "radial-gradient(60% 50% at 10% 0%, color-mix(in oklab, var(--color-primary-core) 16%, transparent), transparent 70%)",
  "radial-gradient(50% 40% at 95% 10%, color-mix(in oklab, var(--color-mesh-glow) 45%, transparent), transparent 70%)",
  "radial-gradient(40% 40% at 80% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

/**
 * Loading shell for pages built on PageFrame: the logo and bell in the header, the header action
 * when the page has one, and the content column where the page's own skeleton goes.
 */
export function PageFrameSkeleton({
  hasAction = false,
  children,
}: {
  /** The page passes a headerAction to PageFrame (a HeaderLink). */
  hasAction?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main
      className="relative isolate flex min-h-dvh flex-col bg-[var(--color-neutral-off-white)]"
      style={{ backgroundImage: WASH }}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <Skeleton className="aspect-[860/220] h-10 sm:h-12" />
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Skeleton className="size-10 rounded-full" />
          {hasAction && <Skeleton className="h-10 w-32 rounded-full" />}
        </div>
      </header>
      <div
        role="status"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12"
      >
        <span className="sr-only">Loading…</span>
        {children}
      </div>
    </main>
  );
}
