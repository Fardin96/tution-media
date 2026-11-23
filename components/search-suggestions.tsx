"use client";

import { IconBook2, IconMapPin } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Range } from "@/lib/fuzzy";

export type SuggestionRow = {
  /** Stable per entry, so the option id and the highlight survive re-renders. */
  key: string;
  label: string;
  /** Matched ranges in `label`, drawn semibold. */
  ranges: Range[];
  /** Muted second line: the district for an area, "Whole district" for a district. */
  secondary?: string;
  icon: "subject" | "place";
};

/**
 * Option id for a row, by its index in the list. Index-based, so ids are always valid IDREFs
 * and cannot collide, whatever the district names contain.
 */
export function optionId(listboxId: string, index: number): string {
  return `${listboxId}-opt-${index}`;
}

/** The label with each matched range in semibold. Ranges come sorted and merged from fuzzy.ts. */
export function highlightLabel(label: string, ranges: Range[]): ReactNode {
  if (ranges.length === 0) return label;
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(label.slice(at, start));
    parts.push(
      <span key={i} className="font-semibold">
        {label.slice(start, end)}
      </span>,
    );
    at = end;
  });
  if (at < label.length) parts.push(label.slice(at));
  return parts;
}

type PopupProps = {
  open: boolean;
  id: string;
  /** Accessible name of the listbox. */
  label: string;
  rows: SuggestionRow[];
  /** Index of the highlighted row, or -1 for none. */
  active: number;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
};

/**
 * The suggestion listbox under a search field. It is rendered outside the field's
 * overflow-hidden wrapper, and the parent positions it (absolute, top-full).
 */
export function SuggestionPopup({
  open,
  id,
  label,
  rows,
  active,
  onPick,
  onHover,
}: PopupProps) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.ul
          key="popup"
          id={id}
          role="listbox"
          aria-label={label}
          initial={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, y: -6, scale: 0.97, filter: "blur(4px)" }
          }
          animate={
            reduce
              ? { opacity: 1, transition: { duration: 0.12 } }
              : {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  filter: "blur(0px)",
                  transition: { type: "spring", duration: 0.28, bounce: 0.12 },
                }
          }
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0.12 } }
              : {
                  opacity: 0,
                  y: -4,
                  scale: 0.98,
                  filter: "blur(2px)",
                  transition: { duration: 0.14, ease: [0.23, 1, 0.32, 1] },
                }
          }
          style={{ transformOrigin: "top center" }}
          className="border-chip-border absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-[20px] border bg-[var(--color-neutral-white)] p-1.5 text-start shadow-[0_16px_40px_-12px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.04)]"
        >
          <SuggestionRows
            id={id}
            rows={rows}
            active={active}
            onPick={onPick}
            onHover={onHover}
          />
        </motion.ul>
      )}
    </AnimatePresence>
  );
}

/**
 * Rows. The one-time stagger runs only while this mounted (one popup opening); rows that
 * arrive later, for example when a slow lookup lands, appear at once.
 */
function SuggestionRows({
  id,
  rows,
  active,
  onPick,
  onHover,
}: Omit<PopupProps, "open" | "label">) {
  const reduce = useReducedMotion();
  const [fresh, setFresh] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setFresh(false), 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (active < 0) return;
    document
      .getElementById(optionId(id, active))
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active, id]);

  return rows.map((row, i) => {
    const Icon = row.icon === "subject" ? IconBook2 : IconMapPin;
    const animate = fresh && !reduce;
    return (
      <motion.li
        key={row.key}
        id={optionId(id, i)}
        role="option"
        aria-selected={i === active}
        initial={animate ? { opacity: 0, y: 4 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.18,
          delay: animate ? Math.min(i, 5) * 0.018 : 0,
          ease: [0.23, 1, 0.32, 1],
        }}
        // Keep focus in the input: the popup is clicked, not focused.
        onMouseDown={(e) => e.preventDefault()}
        // Move, not enter: rows re-rendering under a still pointer must not steal the highlight.
        onMouseMove={() => {
          if (i !== active) onHover(i);
        }}
        onClick={() => onPick(i)}
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2 text-[15px] text-[var(--color-neutral-charcoal)]",
          // Primary tint, as on an open FAQ item: surface-subtle is too faint on the white popup.
          i === active &&
            "bg-[color-mix(in_oklab,var(--color-primary-core)_8%,white)]",
        )}
      >
        <Icon
          size={16}
          stroke={1.5}
          aria-hidden
          className="shrink-0 text-[var(--color-neutral-gray)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            {highlightLabel(row.label, row.ranges)}
          </span>
          {row.secondary && (
            <span className="block text-xs text-[var(--color-neutral-gray)]">
              {row.secondary}
            </span>
          )}
        </span>
      </motion.li>
    );
  });
}
