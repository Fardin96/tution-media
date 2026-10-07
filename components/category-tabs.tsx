"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import { motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Layers01Icon } from "@hugeicons/core-free-icons";
import { categories, type CategoryId } from "@/lib/tutors";
import { cn } from "@/lib/utils";

export type CategoryFilter = CategoryId | "all";

const tabs = [{ id: "all", label: "All", icon: null }, ...categories] as const;

type CategoryTabsProps = {
  value: CategoryFilter;
  onValueChange: (value: CategoryFilter) => void;
  className?: string;
  children?: React.ReactNode;
};

/** Needs a MotionConfig ancestor for the indicator spring (see TutorDirectory). */
export function CategoryTabs({
  value,
  onValueChange,
  className,
  children,
}: CategoryTabsProps) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={(v) => onValueChange(v as CategoryFilter)}
      className={cn("w-full max-w-[77.5rem]", className)}
    >
      {/* Scrolls sideways below lg, where the tabs can't share one row.
          The gray rule is an inset shadow, not a border, so scroll clipping
          can't eat the active tab's blue line that sits on top of it.
          layoutScroll lets the sliding indicator measure correctly while scrolled. */}
      <TabsPrimitive.List aria-label="Subject categories" asChild>
        <motion.div
          layoutScroll
          className="-mx-6 flex snap-x scroll-px-6 [scrollbar-width:none] gap-2 overflow-x-auto px-6 shadow-[inset_0_-1px_0_var(--color-tab-rule)] lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((c) => (
            <TabsPrimitive.Trigger
              key={c.id}
              value={c.id}
              className="relative isolate flex h-12 shrink-0 snap-start items-center justify-center gap-2 px-4 text-base leading-6 whitespace-nowrap text-[var(--color-tab-inactive)] transition-colors duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)] focus-visible:ring-inset data-[state=active]:text-[var(--color-primary-core)] data-[state=inactive]:hover:text-[var(--color-neutral-charcoal)] lg:flex-1 lg:px-0"
            >
              {value === c.id && (
                <motion.span
                  layoutId="category-tab-indicator"
                  aria-hidden
                  className="absolute inset-0 -z-10 border-b-2 border-[var(--color-primary-core)] bg-[linear-gradient(to_bottom,transparent,color-mix(in_oklab,var(--color-primary-core)_10%,white))]"
                />
              )}
              {c.icon ? (
                <span
                  aria-hidden
                  className="size-6 shrink-0 bg-current"
                  style={{
                    mask: `url(/assets/ic/ic-categories/${c.icon}.png) center/contain no-repeat`,
                  }}
                />
              ) : (
                <HugeiconsIcon
                  icon={Layers01Icon}
                  aria-hidden
                  className="size-6 shrink-0"
                  strokeWidth={1.5}
                />
              )}
              {c.label}
            </TabsPrimitive.Trigger>
          ))}
        </motion.div>
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}
