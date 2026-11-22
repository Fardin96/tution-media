"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useAnimate,
  useInView,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "motion/react";

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
  const [scope, animate] = useAnimate<HTMLDivElement>();
  // The drift stops while the section is off screen or the tab is hidden.
  const inView = useInView(scope);
  const [tabVisible, setTabVisible] = useState(true);
  const drift = useRef<AnimationPlaybackControls[]>([]);
  const running = !shouldReduceMotion && inView && tabVisible;

  useEffect(() => {
    const onVisibility = () =>
      setTabVisible(document.visibilityState !== "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Each property is its own controller so the drift can be paused and resumed
  // in place. Declarative `animate` cannot pause, and restarting would jump.
  useEffect(() => {
    const el = scope.current;
    if (shouldReduceMotion || !el) return;
    const controls = [
      animate(
        el,
        { x: ["0%", "1.5%", "0%", "-1%", "0%"] },
        { duration: 24, repeat: Infinity, ease: "easeInOut" },
      ),
      animate(
        el,
        { y: ["0%", "-1%", "1%", "0%", "0%"] },
        { duration: 28, repeat: Infinity, ease: "easeInOut" },
      ),
      animate(
        el,
        { scale: [1.04, 1.06, 1.05, 1.06, 1.04] },
        { duration: 32, repeat: Infinity, ease: "easeInOut" },
      ),
    ];
    drift.current = controls;
    return () => controls.forEach((c) => c.stop());
  }, [animate, scope, shouldReduceMotion]);

  useEffect(() => {
    drift.current.forEach((c) => (running ? c.play() : c.pause()));
  }, [running, shouldReduceMotion]);

  // Same element on server and client; `useReducedMotion` is null during SSR.
  // The fade-in is CSS, not motion: the server HTML must be visible on its
  // own, or the gradient stays at opacity 0 until (and unless) JS hydrates.
  // It sits on an inner div because tw-animate's keyframes also write
  // `transform`, which would fight motion's drift on the same element.
  return (
    <motion.div
      ref={scope}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      initial={{ scale: 1.04 }}
    >
      <div className="animate-in fade-in absolute inset-0 duration-1000 ease-out">
        {children}
      </div>
    </motion.div>
  );
}
