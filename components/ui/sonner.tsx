"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Alert02Icon,
  MultiplicationSignCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";

// Surface/text pairs from globals.css (measured: success 5.40, warning 5.20, error 6.05, info 11.10).
const TONE = {
  success:
    "bg-[var(--color-semantic-success-surface)]! text-[var(--color-semantic-success-text)]! border-[color-mix(in_oklab,var(--color-semantic-success-text)_25%,transparent)]!",
  warning:
    "bg-[var(--color-semantic-warning-surface)]! text-[var(--color-semantic-warning-text)]! border-[color-mix(in_oklab,var(--color-semantic-warning-text)_25%,transparent)]!",
  error:
    "bg-[var(--color-semantic-error-surface)]! text-[var(--color-semantic-error-text)]! border-[color-mix(in_oklab,var(--color-semantic-error-text)_25%,transparent)]!",
  info: "bg-[var(--color-secondary-sky)]! text-[var(--color-primary-deep)]! border-[color-mix(in_oklab,var(--color-primary-deep)_25%,transparent)]!",
};

// Keyboard open on mobile covers the bottom of the screen, so toasts move to the top.
function useToastPosition(): ToasterProps["position"] {
  const [mobile, setMobile] = useState(false);
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const viewport = window.visualViewport;
    const sync = () => {
      setMobile(media.matches);
      setKeyboard(
        !!viewport &&
          window.innerHeight - viewport.height > window.innerHeight * 0.25,
      );
    };
    sync();
    media.addEventListener("change", sync);
    viewport?.addEventListener("resize", sync);
    return () => {
      media.removeEventListener("change", sync);
      viewport?.removeEventListener("resize", sync);
    };
  }, []);

  if (!mobile) return "bottom-right";
  return keyboard ? "top-center" : "bottom-center";
}

const Toaster = ({ ...props }: ToasterProps) => {
  const position = useToastPosition();
  return (
    <Sonner
      position={position}
      theme="light"
      className="toaster group"
      icons={{
        success: (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        info: (
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        warning: (
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        error: (
          <HugeiconsIcon
            icon={MultiplicationSignCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        loading: (
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            className="size-4 animate-spin"
          />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--color-neutral-white)",
          "--normal-text": "var(--color-neutral-charcoal)",
          "--normal-border": "var(--color-neutral-border)",
          "--border-radius": "var(--border-radius-12)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          success: TONE.success,
          error: TONE.error,
          warning: TONE.warning,
          info: TONE.info,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
