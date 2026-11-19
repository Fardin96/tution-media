import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Read-only stars with fractional fill (4.5 fills four and a half). The wrapper carries the
 * one label screen readers get, so the individual stars stay hidden.
 */
export function StarRating({
  value,
  size = "md",
  className,
}: {
  /** 0 to 5; values outside are clamped. */
  value: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const clamped = Math.min(5, Math.max(0, Number.isFinite(value) ? value : 0));
  const dimension =
    size === "lg" ? "size-6" : size === "sm" ? "size-4" : "size-5";
  const rounded = Math.round(clamped * 10) / 10;

  return (
    <span
      role="img"
      aria-label={`Rated ${rounded} out of 5`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.min(1, Math.max(0, clamped - index));
        return (
          <span
            key={index}
            aria-hidden="true"
            className={cn("relative inline-block shrink-0", dimension)}
          >
            <Star
              className={cn(
                dimension,
                "text-[var(--color-neutral-charcoal)]/20",
              )}
            />
            <span
              className="absolute inset-y-0 start-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star
                className={cn(
                  dimension,
                  "max-w-none fill-[var(--color-semantic-warning)] text-[var(--color-semantic-warning)]",
                )}
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}
