"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { RATING_LABEL } from "@/lib/reviews";

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Five real radio inputs, one per star. Arrow keys move the choice (and focus) in reading
 * order, Home and End jump to the ends, and hovering previews a value before it is picked.
 */
export function StarRatingInput({
  value,
  onChange,
  name,
  label = "Rating",
  describedBy,
  invalid,
  disabled,
}: {
  /** 0 means nothing picked yet. */
  value: number;
  onChange: (value: number) => void;
  name: string;
  label?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const shown = hover || value;

  function move(to: number) {
    const next = Math.min(5, Math.max(1, to));
    onChange(next);
    refs.current[next - 1]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, star: number) {
    const rtl =
      typeof document !== "undefined" && document.documentElement.dir === "rtl";
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        move(star + (rtl ? -1 : 1));
        break;
      case "ArrowLeft":
        event.preventDefault();
        move(star + (rtl ? 1 : -1));
        break;
      case "ArrowDown":
        event.preventDefault();
        move(star + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(star - 1);
        break;
      case "Home":
        event.preventDefault();
        move(1);
        break;
      case "End":
        event.preventDefault();
        move(5);
        break;
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div
        role="radiogroup"
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onMouseLeave={() => setHover(0)}
        className="flex items-center"
      >
        {STARS.map((star) => {
          const filled = star <= shown;
          return (
            <label
              key={star}
              onMouseEnter={() => !disabled && setHover(star)}
              className={cn(
                "relative flex size-10 items-center justify-center",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <input
                ref={(el) => {
                  refs.current[star - 1] = el;
                }}
                type="radio"
                name={name}
                value={star}
                checked={value === star}
                disabled={disabled}
                // Only the picked star (or the first, before any pick) is a tab stop.
                tabIndex={
                  value === star || (value === 0 && star === 1) ? 0 : -1
                }
                onChange={() => onChange(star)}
                onKeyDown={(event) => onKeyDown(event, star)}
                className="peer sr-only"
              />
              <span className="sr-only">
                {star} {star === 1 ? "star" : "stars"}
              </span>
              <Star
                aria-hidden="true"
                className={cn(
                  "size-7 transition-[color,fill,scale] duration-150 ease-out peer-active:scale-[0.96] motion-reduce:transition-none",
                  filled
                    ? "fill-[var(--color-semantic-warning)] text-[var(--color-semantic-warning)]"
                    : "fill-transparent text-[var(--color-neutral-charcoal)]/25",
                )}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0.5 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-[var(--color-primary-core)]"
              />
            </label>
          );
        })}
      </div>
      <span
        aria-hidden="true"
        className="min-h-5 text-sm font-medium text-[var(--color-text-secondary)]"
      >
        {shown ? RATING_LABEL[shown] : ""}
      </span>
    </div>
  );
}
