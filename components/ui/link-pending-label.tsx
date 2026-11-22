"use client";

import { useLinkStatus } from "next/link";
import { PendingLabel } from "@/components/ui/pending-label";

/**
 * Content for a button-styled <Link>: shows Spinner 05 while the navigation is pending.
 * Must sit inside the <Link>. A prefetched route with a loading.tsx skips the pending state
 * and shows its skeleton at once.
 */
export function LinkPendingLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <PendingLabel pending={pending} className={className}>
      {children}
    </PendingLabel>
  );
}
