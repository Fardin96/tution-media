"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Client-only drift wrapper, so `MeshGradient` itself stays a server component.
 * Base scale 1.04 hides the edges while it moves up to ±1.5%.
 */
export function AnimatedMeshGradientLayer({
  children,
}: {
  children: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();

  // Same element on server and client; only the animation target changes,
  // because `useReducedMotion` is null during SSR.
  // The fade-in is CSS, not motion: the server HTML must be visible on its
  // own, or the gradient stays at opacity 0 until (and unless) JS hydrates.
  // It sits on an inner div because tw-animate's keyframes also write
  // `transform`, which would fight motion's drift on the same element.
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      initial={{ scale: 1.04 }}
      animate={
        shouldReduceMotion
          ? {}
          : {
              x: ["0%", "1.5%", "0%", "-1%", "0%"],
              y: ["0%", "-1%", "1%", "0%", "0%"],
              scale: [1.04, 1.06, 1.05, 1.06, 1.04],
            }
      }
      transition={{
        x: { duration: 24, repeat: Infinity, ease: "easeInOut" },
        y: { duration: 28, repeat: Infinity, ease: "easeInOut" },
        scale: { duration: 32, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      <div className="animate-in fade-in absolute inset-0 duration-1000 ease-out">
        {children}
      </div>
    </motion.div>
  );
}
