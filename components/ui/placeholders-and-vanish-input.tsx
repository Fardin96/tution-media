"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Particle = { x: number; y: number; r: number; color: string };

/**
 * One input with rotating placeholders that vanishes into particles when its
 * parent <form> submits. The form owns submission; this only animates.
 */
export function PlaceholdersAndVanishInput({
  placeholders,
  name,
  label,
  type = "text",
  autoComplete,
  className,
}: {
  placeholders: string[];
  name: string;
  /** Accessible name; the animated placeholder is not exposed to AT. */
  label: string;
  type?: "text" | "search";
  autoComplete?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);

  useEffect(() => {
    if (reduceMotion || placeholders.length < 2) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(id);
      id = setInterval(
        () => setCurrentPlaceholder((p) => (p + 1) % placeholders.length),
        3000
      );
    };
    const onVisibility = () =>
      document.visibilityState === "visible" ? start() : clearInterval(id);
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [placeholders.length, reduceMotion]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [animating, setAnimating] = useState(false);

  const draw = useCallback(() => {
    const input = inputRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!input || !ctx) return;

    // Drawn at 2x and scaled down 50% in CSS, so particles stay crisp.
    ctx.canvas.width = 800;
    ctx.canvas.height = 800;
    ctx.clearRect(0, 0, 800, 800);
    const cs = getComputedStyle(input);
    ctx.font = `${parseFloat(cs.fontSize) * 2}px ${cs.fontFamily}`;
    ctx.fillStyle = cs.color;
    ctx.fillText(input.value, 0, 40);

    const px = ctx.getImageData(0, 0, 800, 800).data;
    const particles: Particle[] = [];
    for (let y = 0; y < 800; y++) {
      for (let x = 0; x < 800; x++) {
        const i = 4 * (y * 800 + x);
        if (px[i + 3] > 0) {
          particles.push({
            x,
            y,
            r: 1,
            color: `rgba(${px[i]}, ${px[i + 1]}, ${px[i + 2]}, ${px[i + 3] / 255})`,
          });
        }
      }
    }
    particlesRef.current = particles;
  }, []);

  const animate = useCallback((start: number) => {
    const frame = (pos: number) => {
      requestAnimationFrame(() => {
        const next: Particle[] = [];
        for (const p of particlesRef.current) {
          if (p.x < pos) next.push(p);
          else if (p.r > 0) {
            p.x += Math.random() > 0.5 ? 1 : -1;
            p.y += Math.random() > 0.5 ? 1 : -1;
            p.r -= 0.05 * Math.random();
            next.push(p);
          }
        }
        particlesRef.current = next;
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          ctx.clearRect(pos, 0, 800, 800);
          for (const p of next) {
            if (p.x > pos) {
              ctx.beginPath();
              ctx.rect(p.x, p.y, p.r, p.r);
              ctx.strokeStyle = p.color;
              ctx.stroke();
            }
          }
        }
        if (next.length > 0) frame(pos - 8);
        else {
          setValue("");
          setAnimating(false);
        }
      });
    };
    frame(start);
  }, []);

  // Vanish when the surrounding form submits (the form reads the value first).
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || reduceMotion) return;
    const onSubmit = () => {
      if (!inputRef.current?.value) return;
      draw();
      setAnimating(true);
      animate(particlesRef.current.reduce((m, p) => Math.max(m, p.x), 0));
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [draw, animate, reduceMotion]);

  return (
    <div className={cn("relative h-12 min-w-0 flex-1 overflow-hidden", className)}>
      <canvas
        aria-hidden
        ref={canvasRef}
        className={cn(
          "pointer-events-none absolute top-[20%] left-0 origin-top-left scale-50",
          animating ? "opacity-100" : "opacity-0"
        )}
      />
      <input
        ref={inputRef}
        name={name}
        type={type}
        aria-label={label}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => !animating && setValue(e.target.value)}
        className={cn(
          "relative z-10 h-full w-full bg-transparent text-base text-[var(--color-neutral-charcoal)] outline-none [&::-webkit-search-cancel-button]:hidden",
          animating && "text-transparent"
        )}
      />
      {/* Hidden instantly on input; the exit animation is only for rotation. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center",
          value && "invisible"
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
              aria-hidden
              key={currentPlaceholder}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1, transition: { duration: 0.25, ease: "easeOut" } }}
              exit={{ y: -8, opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
              className="w-full truncate text-start text-base text-[var(--color-neutral-gray)]"
            >
              {placeholders[currentPlaceholder]}
            </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
