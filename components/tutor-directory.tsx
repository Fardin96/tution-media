"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { CategoryTabs, type CategoryFilter } from "@/components/category-tabs";
import { TutorCard } from "@/components/tutor-card";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { tutors } from "@/lib/tutors";

// Two rows at desktop; "View All" leads to the full list.
const PREVIEW_COUNT = 8;

export function TutorDirectory({ className }: { className?: string }) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // GlowingEffect animates with motion's animate(), which ignores MotionConfig;
  // with reduced motion the glow jumps to the cursor instead of gliding.
  const reduceMotion = useReducedMotion();

  const visible = tutors
    .filter((t) => category === "all" || t.categories.includes(category))
    .slice(0, PREVIEW_COUNT);

  return (
    // reducedMotion="user": tabs and cards switch instantly when the OS asks for less motion.
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
    >
      <CategoryTabs
        value={category}
        onValueChange={(v) => {
          setCategory(v);
          listRef.current?.scrollTo({ left: 0 });
        }}
        className={className}
      >
        {/* Phone: sideways carousel, next card peeks to show there's more.
            py-6/-my-6 leaves room so overflow doesn't clip the selected glow.
            sm+: grid. layoutScroll keeps layout animations correct while scrolled.
            `relative` is required by popLayout: exiting cards are popped out as
            position:absolute against this list. Without it they were placed against
            a far ancestor, and on touch devices the page jumped to the top.
            grid-rows reserve the rows a full preview (8 cards) needs, so a filter with
            fewer tutors doesn't shrink the page and pull the viewport up. */}
        <motion.ul
          ref={listRef}
          layoutScroll
          aria-label="Tutors"
          className="relative -mx-6 mt-4 -mb-6 flex snap-x snap-mandatory scroll-px-6 [scrollbar-width:none] gap-4 overflow-x-auto px-6 py-6 sm:mx-0 sm:mt-10 sm:mb-0 sm:grid sm:grid-cols-2 sm:grid-rows-[repeat(4,minmax(15.125rem,auto))] sm:gap-6 sm:overflow-visible sm:p-0 lg:grid-cols-3 lg:grid-rows-[repeat(3,minmax(15.125rem,auto))] xl:grid-cols-4 xl:grid-rows-[repeat(2,minmax(15.125rem,auto))] [&::-webkit-scrollbar]:hidden"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((t) => (
              <motion.li
                key={t.id}
                layout="position"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="relative w-[min(85%,18.25rem)] shrink-0 snap-start rounded-[20px] sm:w-auto"
              >
                <GlowingEffect
                  spread={40}
                  glow
                  disabled={false}
                  proximity={64}
                  inactiveZone={0.01}
                  borderWidth={1}
                  // With inset-px the 1px ring lands exactly on the card's own 1px border.
                  className="inset-px"
                  movementDuration={reduceMotion ? 0 : 2}
                />
                <TutorCard
                  tutor={t}
                  selected={selectedId === t.id}
                  onSelect={() =>
                    setSelectedId((id) => (id === t.id ? null : t.id))
                  }
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </CategoryTabs>
    </MotionConfig>
  );
}
