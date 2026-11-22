"use client";

import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Animates its own height to follow its content (animate-ui's AutoHeight): an inline form opening,
 * cards added by "View more". Overflow is clipped only while it moves, so focus rings are not cut
 * off once it settles. Without ResizeObserver (jsdom) it stays at auto height.
 */
export function AutoHeight({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [height, setHeight] = useState<number | "auto">("auto");
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ height }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 300, damping: 30, restDelta: 0.5 }
      }
      style={{ overflow: moving ? "hidden" : "visible" }}
      onAnimationStart={() => setMoving(true)}
      onAnimationComplete={() => setMoving(false)}
    >
      {/* flow-root keeps the children's margins inside the measured box. */}
      <div ref={ref} className="relative flow-root">
        {children}
      </div>
    </motion.div>
  );
}
