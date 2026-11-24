"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/profile/styles";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
} from "@/components/animate-ui/primitives/radix/popover";

// Twelve shallow lobes (arc radius 3.8) on a ring of radius 10, centred in a 24 viewBox.
const ROSETTE =
  "M12 2A3.8 3.8 0 0 1 17 3.34A3.8 3.8 0 0 1 20.66 7A3.8 3.8 0 0 1 22 12A3.8 3.8 0 0 1 20.66 17A3.8 3.8 0 0 1 17 20.66A3.8 3.8 0 0 1 12 22A3.8 3.8 0 0 1 7 20.66A3.8 3.8 0 0 1 3.34 17A3.8 3.8 0 0 1 2 12A3.8 3.8 0 0 1 3.34 7A3.8 3.8 0 0 1 7 3.34A3.8 3.8 0 0 1 12 2Z";

/** The one copy for what the badge means: the svg title and the popover both use it. */
export const VERIFIED_MEANING =
  "Verified: ID checked, phone verified and a strong profile.";

/**
 * Green rosette with a white tick: the profile is verified. Static and not focusable.
 * `decorative` drops the image role and label for places where text already says "verified".
 */
export function VerifiedBadge({
  size = 18,
  className,
  decorative = false,
}: {
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "Verified" };
  return (
    <svg
      {...a11y}
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn(
        "inline-block align-[-0.15em] text-[var(--color-verified)]",
        className,
      )}
    >
      {!decorative && <title>{VERIFIED_MEANING}</title>}
      <path
        d={ROSETTE}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <path
        d="M7.6 12.4 10.5 15.3 16.4 9.3"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The badge as a button that opens its meaning on tap, click or keyboard. Escape and an outside
 * click close it. `withLabel` shows "Verified" next to the icon.
 */
export function VerifiedBadgeTip({
  size = 18,
  className,
  withLabel = false,
}: {
  size?: number;
  className?: string;
  withLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Verified"
          className={cn(
            "-my-1 ms-1.5 inline-flex min-h-6 min-w-6 items-center justify-center gap-1 rounded-full text-[var(--color-verified)]",
            focusRing,
            className,
          )}
        >
          <VerifiedBadge decorative size={size} />
          {withLabel && <span className="text-sm font-semibold">Verified</span>}
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          side="top"
          sideOffset={6}
          className="z-50 max-w-xs rounded-2xl bg-[var(--color-neutral-charcoal)] px-3 py-2 text-sm text-[var(--color-neutral-white)] shadow-lg"
        >
          {VERIFIED_MEANING}
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
}
