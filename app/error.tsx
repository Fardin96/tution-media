"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // error.message is never shown: it can carry server details.
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-neutral-off-white)] px-4">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-neutral-charcoal)]">
          Something went wrong
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Try again, or go back to the home page.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-primary-core)] px-6 font-medium text-[var(--color-neutral-white)] transition-[background-color,scale] duration-150 ease-out hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)] active:scale-[0.96]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full px-6 font-medium text-[var(--color-primary-core)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)]"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
