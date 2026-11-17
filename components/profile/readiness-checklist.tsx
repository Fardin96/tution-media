"use client";

import { useId } from "react";
import Link from "next/link";
import { ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { missingRequirementLabel } from "@/lib/api-errors";
import { card, focusRing } from "@/components/profile/styles";

const PROFILE_HREF = "/dashboard#profile";

/** Where each missing profile item is fixed. Keys are the API's tutor_missing_requirements() values. */
const FIXES: Record<string, { label: string; href: string }> = {
  name: { label: "Add your name", href: PROFILE_HREF },
  address: { label: "Add your address", href: PROFILE_HREF },
  location_pin: { label: "Pin your location on the map", href: PROFILE_HREF },
  area: { label: "Add a teaching area", href: PROFILE_HREF },
  phone_number: { label: "Add your phone number", href: PROFILE_HREF },
  phone_verification: {
    label: "Verify your phone number",
    href: PROFILE_HREF,
  },
  verification: {
    label: "Get your profile verified",
    href: "/dashboard#verification",
  },
  default_requirement: {
    label: "Create a default requirement set",
    href: "/dashboard/tutor/requirements/new",
  },
};

function fixFor(key: string): { label: string; href: string } {
  return (
    FIXES[key] ?? {
      label: `Complete your ${missingRequirementLabel(key)}`,
      href: PROFILE_HREF,
    }
  );
}

/** The profile gaps that block publishing, one row per item with a link to where it is fixed. */
export function ReadinessChecklist({ missing }: { missing: string[] }) {
  const headingId = useId();
  const items = [...new Set(missing)].map((key) => ({
    key,
    ...fixFor(key),
  }));

  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={cn(card, "p-5 sm:p-6")}>
      <h2
        id={headingId}
        className="text-base font-semibold text-[var(--color-neutral-charcoal)] sm:text-lg"
      >
        Finish your profile to publish
      </h2>
      <ul className="mt-4 grid gap-1">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={cn(
                "group flex min-h-11 items-center justify-between gap-3 rounded-[12px] px-3 text-sm font-medium text-[var(--color-neutral-charcoal)] transition-[background-color] duration-150 ease-out hover:bg-[var(--color-surface-subtle)] motion-reduce:transition-none",
                focusRing,
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Circle
                  aria-hidden="true"
                  className="size-4 shrink-0 text-[var(--color-text-secondary)]"
                />
                {item.label}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-[var(--color-text-secondary)] transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
