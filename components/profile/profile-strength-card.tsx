"use client";

import { Check } from "lucide-react";
import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
} from "@/components/animate-ui/primitives/radix/popover";
import { drawAttention } from "@/lib/attention";
import { CountingNumber } from "@/components/motion/counting-number";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import type { Schemas } from "@/lib/api-client";
import type { ProfileRole } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { focusRing, ghostButton } from "./styles";

type Strength = Schemas["ProfileStrength"];
type Key = Strength["items"][number]["key"];

/** `href` is the section that fixes it; no href means the phone dialog. */
type Item = { todo: string; done: string; href?: string };

const TUTOR_ITEMS: Partial<Record<Key, Item>> = {
  basics: {
    todo: "Add your name and address",
    done: "Name and address",
    href: "#profile",
  },
  phone_verified: { todo: "Verify your phone number", done: "Phone number" },
  photo: {
    todo: "Add a profile photo",
    done: "Profile photo",
    href: "#profile-photo",
  },
  institute: {
    todo: "Add your university or college",
    done: "University or college",
    href: "#profile",
  },
  subjects: {
    todo: "Add the subjects you teach",
    done: "Subjects",
    href: "#profile",
  },
  location_pin: {
    todo: "Pin your location on the map",
    done: "Location on the map",
    href: "#profile",
  },
  default_set: {
    todo: "Set up a default requirement set",
    done: "Default requirement set",
    href: "/dashboard/tutor/requirements",
  },
  id_verified: {
    todo: "Get your ID verified",
    done: "ID verified",
    href: "#verification",
  },
  credential: {
    todo: "Add a certificate",
    done: "Certificate",
    href: "#credentials",
  },
  video: {
    todo: "Add a teaching video",
    done: "Teaching video",
    href: "#videos",
  },
};

const STUDENT_ITEMS: Partial<Record<Key, Item>> = {
  basics: {
    todo: "Add your name, address and emergency contact",
    done: "Name, address and emergency contact",
    href: "#profile",
  },
  phone_verified: { todo: "Verify your phone number", done: "Phone number" },
  photo: {
    todo: "Add a profile photo",
    done: "Profile photo",
    href: "#profile-photo",
  },
  location_pin: {
    todo: "Pin your location on the map",
    done: "Location on the map",
    href: "#profile",
  },
  id_verified: {
    todo: "Get your student ID verified",
    done: "Student ID verified",
    href: "#verification",
  },
  whatsapp: {
    todo: "Add a WhatsApp number",
    done: "WhatsApp number",
    href: "#profile",
  },
};

const ITEMS: Record<ProfileRole, Partial<Record<Key, Item>>> = {
  TUTOR: TUTOR_ITEMS,
  STUDENT: STUDENT_ITEMS,
};

// Same curve as --ease-out in globals.css, for motion.
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const percentText = (n: number) => `${Math.round(n)}%`;

// The frosted card that sits beside the photo in the dashboard hero.
const HERO_CARD =
  "rounded-[24px] bg-[color-mix(in_oklab,var(--color-neutral-white)_80%,transparent)] p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_12px_32px_-12px_rgb(0_0_0/0.12)] backdrop-blur-md";

// Matches the card's width, and scrolls inside when the screen is short.
const PANEL =
  "z-50 grid max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] min-w-[min(18rem,calc(100vw-2rem))] gap-3 overflow-y-auto rounded-[24px] bg-[var(--color-neutral-white)] p-5 text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_12px_32px_-12px_rgb(0_0_0/0.18)] outline-none";

const SUMMARY = cn(
  "min-h-10 cursor-pointer rounded-sm py-2 text-sm font-semibold text-[var(--color-primary-deep)]",
  focusRing,
);

const ROW =
  "flex min-h-10 w-full items-center justify-between gap-3 rounded-[10px] px-2 text-left text-sm font-medium cursor-pointer text-[var(--color-neutral-charcoal)] transition-[background-color,color] duration-150 ease-out hover:bg-[var(--color-secondary-sky)] hover:text-[var(--color-primary-deep)] motion-reduce:transition-none " +
  focusRing;

export function ProfileStrengthCard({
  role,
  strength,
  applyReadiness,
  onVerifyPhone,
}: {
  role: ProfileRole;
  strength?: Strength;
  applyReadiness?: { ready: boolean };
  onVerifyPhone: () => void;
}) {
  const reduce = useReducedMotion();
  // Only the bar shows; "View more" opens the rest over the page, like the notification bell.
  const [open, setOpen] = useState(false);
  // A row that moved focus elsewhere (a section, the phone dialog) keeps it there on close.
  const leaving = useRef(false);
  if (!strength) return null;

  const { percent, completeAt, badgeAt, verifiedBadge, items } = strength;

  if (percent === 100 && verifiedBadge) {
    return (
      <section
        aria-label="Profile strength"
        className={cn(
          HERO_CARD,
          "flex items-center gap-3 text-sm font-medium text-[var(--color-neutral-charcoal)]",
        )}
      >
        <VerifiedBadge decorative size={20} />
        Profile 100% complete. You have the verified badge.
      </section>
    );
  }

  const copy = ITEMS[role];
  // The biggest gains first.
  const todo = items
    .filter((i) => !i.done && copy[i.key])
    .sort((a, b) => b.weight - a.weight);
  const done = items.filter((i) => i.done && copy[i.key]);
  // Labels this close would overlap if both were centred on their markers at 320px, so they
  // sit on the outside of each marker: the first ends at its marker, the second starts at its.
  const close = badgeAt - completeAt < 25;

  const todoRow = (item: (typeof items)[number]) => {
    const target = copy[item.key]!;
    const content = (
      <>
        <span className="min-w-0">{target.todo}</span>
        <span className="shrink-0 font-semibold text-[var(--color-primary-deep)] tabular-nums">
          +{item.weight}%
        </span>
      </>
    );
    const href = target.href;
    if (href && !href.startsWith("#")) {
      return (
        <li key={item.key}>
          <Link href={href} className={ROW}>
            {content}
          </Link>
        </li>
      );
    }
    const pick = () => {
      leaving.current = true;
      setOpen(false);
      if (!href) onVerifyPhone();
      else if (!drawAttention(href.slice(1))) window.location.hash = href;
    };
    return (
      <li key={item.key}>
        <button type="button" onClick={pick} className={ROW}>
          {content}
        </button>
      </li>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <section
          aria-labelledby="profile-strength-heading"
          className={cn(HERO_CARD, "grid min-w-0 gap-3")}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="profile-strength-heading"
              className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
            >
              Profile strength
            </h2>
            <p className="text-2xl font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
              <CountingNumber value={percent} format={percentText} />
            </p>
          </div>

          <div className="grid gap-2">
            <div className="relative h-2">
              <div
                role="progressbar"
                aria-label="Profile strength"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${percent}%, complete at ${completeAt}%, verified badge at ${badgeAt}%`}
                className="absolute inset-0 overflow-hidden rounded-full bg-[var(--color-skeleton)]"
              >
                <motion.div
                  className="h-full origin-left rounded-full bg-[var(--color-primary-core)]"
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: percent / 100 }}
                  transition={{ duration: reduce ? 0 : 0.6, ease: EASE_OUT }}
                />
              </div>
              {[completeAt, badgeAt].map((at) => (
                <span
                  key={at}
                  aria-hidden="true"
                  className="absolute -top-[3px] h-[14px] w-0.5 -translate-x-1/2 rounded-full bg-[var(--color-neutral-charcoal)]"
                  style={{ left: `${at}%` }}
                />
              ))}
            </div>
            <div
              aria-hidden="true"
              className="relative h-4 text-xs text-[var(--color-text-secondary)]"
            >
              <span
                className={cn(
                  "absolute top-0 whitespace-nowrap",
                  close ? "-translate-x-full pe-1" : "-translate-x-1/2",
                )}
                style={{ left: `${completeAt}%` }}
              >
                Complete
              </span>
              <span
                className={cn(
                  "absolute top-0 whitespace-nowrap",
                  close ? "ps-1" : "-translate-x-1/2",
                )}
                style={{ left: `${badgeAt}%` }}
              >
                Verified
              </span>
            </div>
          </div>

          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                ghostButton,
                "-mb-1 min-h-10 cursor-pointer justify-self-center",
              )}
            >
              {open ? "Show less" : "View more"}
            </button>
          </PopoverTrigger>
        </section>
      </PopoverAnchor>

      <PopoverPortal>
        <PopoverContent
          align="end"
          sideOffset={8}
          collisionPadding={16}
          aria-label="Profile strength details"
          className={PANEL}
          onCloseAutoFocus={(e) => {
            if (!leaving.current) return;
            e.preventDefault();
            leaving.current = false;
          }}
        >
          <div className="grid gap-3">
            <p className="flex items-center gap-2 text-sm text-pretty text-[var(--color-neutral-charcoal)]">
              {verifiedBadge ? (
                <>
                  <VerifiedBadge decorative size={18} />
                  You have the verified badge.
                </>
              ) : percent < completeAt ? (
                `Add ${completeAt - percent}% more to complete your profile.${applyReadiness?.ready ? " You can already apply." : ""}`
              ) : (
                `Your profile is complete. ${percent >= badgeAt ? "Verify your phone and ID" : `Reach ${badgeAt}% with your phone and ID verified`} to get the verified badge.${applyReadiness && !applyReadiness.ready ? " Finish the apply checklist before you can apply." : ""}`
              )}
            </p>

            {todo.length > 0 && (
              <ul className="-mx-2 grid">{todo.map(todoRow)}</ul>
            )}

            {done.length > 0 && (
              <details>
                <summary className={SUMMARY}>Done ({done.length})</summary>
                <ul className="grid">
                  {done.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center gap-2.5 py-1 text-sm text-[var(--color-text-secondary)]"
                    >
                      <Check
                        aria-hidden="true"
                        className="size-4 shrink-0 text-[var(--color-primary-core)]"
                      />
                      {copy[item.key]!.done}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
}
