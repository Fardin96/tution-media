"use client";
import React, { useState, useEffect } from "react";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Tag = "button",
  duration = 1,
  clockwise = true,
  style,
  ...props
}: React.PropsWithChildren<
  {
    as?: React.ElementType;
    containerClassName?: string;
    className?: string;
    duration?: number;
    clockwise?: boolean;
    href?: string;
  } & React.HTMLAttributes<HTMLElement>
>) {
  const [hovered, setHovered] = useState<boolean>(false);
  const [direction, setDirection] = useState<Direction>("TOP");

  useEffect(() => {
    if (hovered) return;
    const rotateDirection = (currentDirection: Direction): Direction => {
      const directions: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
      const currentIndex = directions.indexOf(currentDirection);
      const nextIndex = clockwise
        ? (currentIndex - 1 + directions.length) % directions.length
        : (currentIndex + 1) % directions.length;
      return directions[nextIndex];
    };
    const interval = setInterval(() => {
      setDirection((prevState) => rotateDirection(prevState));
    }, duration * 1000);
    return () => clearInterval(interval);
  }, [hovered, duration, clockwise]);

  const movingMap: Record<Direction, string> = {
    TOP: "radial-gradient(20.7% 50% at 50% 0%, var(--hbg-gradient, hsl(0, 0%, 100%)) 0%, transparent 100%)",
    LEFT: "radial-gradient(16.6% 43.1% at 0% 50%, var(--hbg-gradient, hsl(0, 0%, 100%)) 0%, transparent 100%)",
    BOTTOM:
      "radial-gradient(20.7% 50% at 50% 100%, var(--hbg-gradient, hsl(0, 0%, 100%)) 0%, transparent 100%)",
    RIGHT:
      "radial-gradient(16.2% 41.199999999999996% at 100% 50%, var(--hbg-gradient, hsl(0, 0%, 100%)) 0%, transparent 100%)",
  };

  const highlight =
    "radial-gradient(75% 181.15942028985506% at 50% 50%, var(--hbg-highlight, #3275F8) 0%, transparent 100%)";

  return (
    <Tag
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex h-min w-fit flex-col flex-nowrap content-center items-center justify-center gap-10 overflow-visible rounded-full border decoration-clone p-px transition duration-500",
        containerClassName,
      )}
      style={{ background: "var(--hbg-bg, rgba(0,0,0,0.2))", ...style }}
      {...props}
    >
      <div
        className={cn(
          "z-10 w-auto rounded-[inherit] bg-black px-4 py-2 text-white",
          className,
        )}
      >
        {children}
      </div>
      <motion.div
        className={cn(
          "absolute inset-0 z-0 flex-none overflow-hidden rounded-[inherit]",
        )}
        style={{
          filter: "blur(2px)",
          // Clip the glow to a 2px ring so the button can stay transparent.
          padding: 2,
          mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
          position: "absolute",
          width: "100%",
          height: "100%",
        }}
        initial={{ background: movingMap[direction] }}
        animate={{
          background: hovered
            ? [movingMap[direction], highlight]
            : movingMap[direction],
        }}
        transition={{ ease: "linear", duration: duration ?? 1 }}
      />
    </Tag>
  );
}
