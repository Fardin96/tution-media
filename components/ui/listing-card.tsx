import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { card } from "@/components/profile/styles";

const ACCENT = {
  sky: "bg-[var(--color-secondary-sky)]",
  peach: "bg-[var(--color-secondary-peach)]",
  cream: "bg-[var(--color-secondary-cream)]",
  lime: "bg-[var(--color-secondary-lime)]",
} as const;

export type ListingAccent = keyof typeof ACCENT;

/** Rotates the tile colour down a list so neighbouring cards don't look identical. */
export function accentAt(index: number): ListingAccent {
  const order: ListingAccent[] = ["sky", "peach", "lime", "cream"];
  return order[index % order.length];
}

/**
 * The tutor's own listings (packages, requirement sets, zones): icon tile and status on top,
 * title and body, then a footer with a quiet detail on the start and the key figure on the end.
 */
export function ListingCard({
  icon: Icon,
  accent = "sky",
  status,
  title,
  body,
  details,
  meta,
  figure,
  actions,
  selected = false,
  className,
}: {
  icon: LucideIcon;
  accent?: ListingAccent;
  /** Usually a TonePill. */
  status?: ReactNode;
  /** The heading element (h3) or a button that wraps one. */
  title: ReactNode;
  body?: ReactNode;
  /** Extra lines under the body, in secondary text. */
  details?: ReactNode;
  meta?: ReactNode;
  figure?: ReactNode;
  actions?: ReactNode;
  selected?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        card,
        "flex h-full flex-col gap-3 p-5 transition-[box-shadow] duration-150 ease-out motion-reduce:transition-none",
        selected &&
          "shadow-[inset_0_0_0_2px_var(--color-primary-core),0_1px_2px_rgb(0_0_0/0.04)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-[14px] text-[var(--color-neutral-charcoal)]",
            ACCENT[accent],
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        {status}
      </div>

      <div className="min-w-0">{title}</div>

      {body && (
        <div className="text-sm text-pretty text-[var(--color-text-secondary)]">
          {body}
        </div>
      )}

      {details && (
        <div className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
          {details}
        </div>
      )}

      {(meta || figure) && (
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 pt-2">
          <span className="min-w-0 text-sm text-[var(--color-text-secondary)]">
            {meta}
          </span>
          {figure && (
            <span className="font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
              {figure}
            </span>
          )}
        </div>
      )}

      {actions && (
        <div
          className={cn(
            "flex flex-wrap gap-2",
            !(meta || figure) && "mt-auto pt-2",
          )}
        >
          {actions}
        </div>
      )}
    </article>
  );
}

/** Title style shared by every ListingCard heading. */
export const listingTitleClass =
  "text-lg font-semibold text-balance break-words text-[var(--color-neutral-charcoal)]";
