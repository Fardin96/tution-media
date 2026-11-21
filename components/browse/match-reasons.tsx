import { Check, X } from "lucide-react";
import type { Schemas } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type MatchReason = Schemas["MatchReason"];

/**
 * Why a tuition or tutor fits. Met reasons use the info surface; unmet ones are muted.
 * Each chip carries an icon and its text, so colour is never the only signal.
 */
export function MatchReasons({
  reasons,
  className,
}: {
  reasons: MatchReason[];
  className?: string;
}) {
  if (reasons.length === 0) return null;
  return (
    <ul
      aria-label="Match reasons"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {reasons.map((reason) => (
        <li
          key={reason.rule}
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            reason.ok
              ? "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]"
              : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]",
          )}
        >
          {reason.ok ? (
            <Check aria-hidden="true" className="size-3.5 shrink-0" />
          ) : (
            <X aria-hidden="true" className="size-3.5 shrink-0" />
          )}
          <span className="sr-only">{reason.ok ? "Met: " : "Not met: "}</span>
          <span className="min-w-0 text-pretty">{reason.label}</span>
        </li>
      ))}
    </ul>
  );
}
