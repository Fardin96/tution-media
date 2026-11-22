"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useReducedMotion, useSpring } from "motion/react";

const plain = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * A count that runs up to `value` the first time it scrolls into view (animate-ui's CountingNumber).
 * Screen readers get the final value at once; the moving digits are hidden from them. Reduced
 * motion, or a browser without IntersectionObserver, shows the final value with no count.
 * Pass a `format` defined outside the component, so it keeps its identity between renders.
 */
export function CountingNumber({
  value,
  format = plain,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 30 });

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (ref.current) ref.current.textContent = format(latest);
      }),
    [spring, format],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const settle = () => {
      motionValue.jump(value);
      spring.jump(value);
      el.textContent = format(value);
    };
    if (reduce || typeof IntersectionObserver === "undefined") {
      settle();
      return;
    }
    // Already counted once: later changes (a refetch) move straight to the new value.
    if (motionValue.get() !== 0) {
      motionValue.set(value);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      motionValue.set(value);
      observer.disconnect();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, reduce, motionValue, spring, format]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" className="tabular-nums">
        {format(0)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
