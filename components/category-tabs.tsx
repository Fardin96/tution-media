"use client";

import { useState } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { motion, MotionConfig } from "motion/react";
import { cn } from "@/lib/utils";

const categories = [
  { id: "math", label: "Math", icon: "ic-math" },
  { id: "physics", label: "Physics", icon: "ic-physics" },
  { id: "english", label: "English", icon: "ic-english" },
  { id: "accounting", label: "Accounting", icon: "ic-accounting" },
  { id: "finance", label: "Finance", icon: "ic-finance" },
  { id: "art", label: "Art", icon: "ic-art" },
  { id: "packages", label: "Packages", icon: "ic-packages" },
];

type CategoryTabsProps = {
  className?: string;
  /** Rendered under the tab strip; cards will read the active value from here later. */
  children?: React.ReactNode;
};

export function CategoryTabs({ className, children }: CategoryTabsProps) {
  const [active, setActive] = useState(categories[0].id);

  return (
    // reducedMotion="user": the indicator jumps instead of sliding when the OS asks for less motion.
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
    >
      <TabsPrimitive.Root
        value={active}
        onValueChange={setActive}
        className={cn("w-full max-w-[77.5rem]", className)}
      >
        {/* Scrolls sideways below lg, where 7 tabs can't share one row.
            The gray rule is an inset shadow, not a border, so scroll clipping
            can't eat the active tab's blue line that sits on top of it.
            layoutScroll lets the sliding indicator measure correctly while scrolled. */}
        <TabsPrimitive.List aria-label="Subject categories" asChild>
          <motion.div
            layoutScroll
            className="-mx-6 flex snap-x scroll-px-6 [scrollbar-width:none] gap-2 overflow-x-auto px-6 shadow-[inset_0_-1px_0_var(--color-tab-rule)] lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {categories.map((c) => (
              <TabsPrimitive.Trigger
                key={c.id}
                value={c.id}
                className="relative isolate flex h-12 shrink-0 snap-start items-center justify-center gap-2 px-4 text-base leading-6 whitespace-nowrap text-[var(--color-tab-inactive)] transition-colors duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)] focus-visible:ring-inset data-[state=active]:text-[var(--color-primary-core)] data-[state=inactive]:hover:text-[var(--color-neutral-charcoal)] lg:flex-1 lg:px-0"
              >
                {active === c.id && (
                  <motion.span
                    layoutId="category-tab-indicator"
                    aria-hidden
                    className="absolute inset-0 -z-10 border-b-2 border-[var(--color-primary-core)] bg-[linear-gradient(to_bottom,transparent,color-mix(in_oklab,var(--color-primary-core)_10%,white))]"
                  />
                )}
                <span
                  aria-hidden
                  className="size-6 shrink-0 bg-current"
                  style={{
                    mask: `url(/assets/ic/ic-categories/${c.icon}.png) center/contain no-repeat`,
                  }}
                />
                {c.label}
              </TabsPrimitive.Trigger>
            ))}
          </motion.div>
        </TabsPrimitive.List>
        {children}
      </TabsPrimitive.Root>
    </MotionConfig>
  );
}
