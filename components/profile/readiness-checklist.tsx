"use client";

import { useId } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { missingRequirementLabel } from "@/lib/api-errors";
import type { TutorRequirement } from "@/lib/tutor-requirements";
import { card, focusRing } from "@/components/profile/styles";

const PROFILE_HREF = "/dashboard#profile";
const SETS_HREF = "/dashboard/tutor/requirements";

export interface ReadinessFix {
  /** What is missing, said as the thing to do. */
  label: string;
  /** Why it blocks, or exactly what to change. */
  detail?: string;
  href: string;
}

/** Where each missing profile item is fixed. Keys are the API's tutor_missing_requirements() values. */
const FIXES: Record<string, ReadinessFix> = {
  name: { label: "Add your name", href: PROFILE_HREF },
  address: { label: "Add your address", href: PROFILE_HREF },
  location_pin: { label: "Pin your location on the map", href: PROFILE_HREF },
  area: { label: "Add a teaching area", href: PROFILE_HREF },
  phone_number: { label: "Add your phone number", href: PROFILE_HREF },
  phone_verification: {
    label: "Verify your phone number",
    href: "/dashboard#phone-verification",
  },
  verification: {
    label: "Get your profile verified",
    href: "/dashboard#verification",
  },
};

/**
 * The default set's own gap, read from the set itself. `undefined` means the sets are not
 * loaded, so the fix stays general; `null` means the tutor has no default set.
 */
function defaultSetFix(set: TutorRequirement | null | undefined): ReadinessFix {
  if (set === null) {
    return {
      label: "Create a default requirement set",
      detail: "Your first set becomes your default. You apply with it.",
      href: `${SETS_HREF}/new`,
    };
  }
  if (set === undefined) {
    return {
      label: "Fix your default requirement set",
      detail: "It needs a subject, and a zone or online teaching.",
      href: SETS_HREF,
    };
  }

  const noSubjects = set.subjectIds.length === 0;
  const noPlace = !set.teachesOnline && set.zoneIds.length === 0;
  const gaps = [
    noSubjects && "a subject",
    noPlace && "a zone or online teaching",
  ].filter(Boolean);
  if (gaps.length === 0) {
    return { label: `Check your default set “${set.name}”`, href: SETS_HREF };
  }
  return {
    label: `Default set “${set.name}” needs ${gaps.join(", and ")}`,
    detail: noPlace
      ? "Add a teaching zone to it, or turn on “I also teach online”."
      : "Add at least one subject to it.",
    href: `${SETS_HREF}/${set.id}/edit`,
  };
}

export function readinessFix(
  key: string,
  defaultSet?: TutorRequirement | null,
): ReadinessFix {
  if (key === "default_requirement") return defaultSetFix(defaultSet);
  return (
    FIXES[key] ?? {
      label: `Complete your ${missingRequirementLabel(key)}`,
      href: PROFILE_HREF,
    }
  );
}

/** The profile gaps that block an action, one row per item with a link to where it is fixed. */
export function ReadinessChecklist({
  missing,
  defaultSet,
  title = "Finish your profile to publish",
  description,
  className,
}: {
  missing: string[];
  /** The tutor's default set, so its row can say what the set lacks. */
  defaultSet?: TutorRequirement | null;
  title?: string;
  description?: string;
  className?: string;
}) {
  const id = useId();
  const items = [...new Set(missing)].map((key) => ({
    key,
    ...readinessFix(key, defaultSet),
  }));

  if (items.length === 0) return null;

  const headingId = `${id}-title`;
  const count =
    items.length === 1 ? "1 thing to fix" : `${items.length} things to fix`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(card, "p-5 sm:p-6", className)}
    >
      <div className="grid gap-1">
        <h2
          id={headingId}
          className="text-base font-semibold text-balance text-[var(--color-neutral-charcoal)] sm:text-lg"
        >
          {title}
        </h2>
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          {description ? `${description} ` : ""}
          <span className="font-semibold text-[var(--color-semantic-warning-text)]">
            {count}.
          </span>
        </p>
      </div>
      <ul className="mt-4 grid gap-2">
        {items.map((item) => {
          const labelId = `${id}-${item.key}-label`;
          const detailId = `${id}-${item.key}-detail`;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-labelledby={labelId}
                aria-describedby={item.detail ? detailId : undefined}
                className={cn(
                  "group flex min-h-11 items-center justify-between gap-3 rounded-[12px] bg-[var(--color-semantic-warning-surface)] px-3 py-2.5 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-semantic-warning)_35%,transparent)] transition-[background-color] duration-150 ease-out hover:bg-[color-mix(in_oklab,var(--color-semantic-warning)_16%,var(--color-neutral-white))] motion-reduce:transition-none",
                  focusRing,
                )}
              >
                <span className="flex min-w-0 items-start gap-3">
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-[var(--color-semantic-warning-text)]"
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span
                      id={labelId}
                      className="text-sm font-semibold text-pretty text-[var(--color-neutral-charcoal)]"
                    >
                      {item.label}
                    </span>
                    {item.detail && (
                      <span
                        id={detailId}
                        className="text-sm text-pretty text-[var(--color-text-secondary)]"
                      >
                        {item.detail}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--color-primary-core)]">
                  Fix
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
