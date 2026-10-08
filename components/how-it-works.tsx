"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import { Tabs } from "radix-ui";
import { SectionHeader } from "@/components/section-header";
import { VideoCard } from "@/components/video-card";
import { cn } from "@/lib/utils";

type Step = {
  title: string;
  description: string;
  icon: string;
  /** The icon artwork's own colour; the chip behind it is a 10% tint of it. */
  hue: string;
};

const icons = {
  signup: { icon: "/assets/ic/ic-singup.png", hue: "#0066ff" },
  details: { icon: "/assets/ic/ic-upload.png", hue: "#ff9900" },
  search: { icon: "/assets/ic/ic-search.png", hue: "#002b6b" },
  documents: { icon: "/assets/ic/ic-briefcase.png", hue: "#002b6b" },
  discovered: { icon: "/assets/ic/ic-discovered.png", hue: "#aa16ef" },
};

// ponytail: placeholder copy and thumbnails (posters until the video loads).
const flows = {
  find: {
    label: "Find a Tutor",
    video: {
      title: "How to find a tutor",
      subtitle: "A quick walkthrough",
      thumbnail: "/assets/avatar-demo/client/client2.png",
      video: "/videos/how-to-guardians.mp4",
    },
    steps: [
      {
        title: "Sign up & create an account",
        description: "Join free as a guardian or student in under two minutes.",
        ...icons.signup,
      },
      {
        title: "Add details & requirements",
        description:
          "Tell us the class, subjects, schedule and budget you need.",
        ...icons.details,
      },
      {
        title: "Post requirements & find tutors",
        description:
          "Publish your request and compare verified tutors who apply.",
        ...icons.search,
      },
    ] satisfies Step[],
  },
  become: {
    label: "Become a Tutor",
    video: {
      title: "How to become a tutor",
      subtitle: "A quick walkthrough",
      thumbnail: "/assets/avatar-demo/tutor/tutor1.png",
      video: "/videos/how-to-tutor.mp4",
    },
    steps: [
      {
        title: "Sign up & create an account",
        description: "Register free and set up your tutor profile in minutes.",
        ...icons.signup,
      },
      {
        title: "Add your details",
        description: "Share your subjects, experience, areas and availability.",
        ...icons.details,
      },
      {
        title: "Validate your documents",
        description: "Upload your ID and certificates so we can verify you.",
        ...icons.documents,
      },
      {
        title: "Get discovered!",
        description: "Show up in search and start receiving tuition requests.",
        ...icons.discovered,
      },
    ] satisfies Step[],
  },
};
type Mode = keyof typeof flows;
const modes = Object.keys(flows) as Mode[];

// Staged entrance when switching flows: steps rise in 100ms apart. Hiding is instant.
const list = {
  show: { transition: { staggerChildren: 0.1 } },
  hide: {},
};
const item = {
  show: { opacity: 1, y: 0 },
  hide: { opacity: 0, y: 8, transition: { duration: 0 } },
};

export function HowItWorks() {
  const [mode, setMode] = useState<Mode>("find");
  const [playing, setPlaying] = useState(false);
  // A tap-to-pause wins over autoplay until the video leaves view.
  const userPaused = useRef(false);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const flow = flows[mode];

  // Autoplay while the video is on screen; pause when it leaves.
  useEffect(() => {
    const el = videoBoxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          userPaused.current = false;
          setPlaying(false);
        } else if (!reduceMotion && !userPaused.current) {
          setPlaying(true);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduceMotion]);

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="scroll-mt-[calc(var(--navbar-top-offset)+var(--navbar-height))] bg-[var(--color-neutral-white)] px-6 py-14 sm:py-16 lg:py-[88px]"
    >
      <MotionConfig
        reducedMotion="user"
        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      >
        <Tabs.Root
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          className="mx-auto grid w-full max-w-[77.5rem] gap-10 xl:grid-cols-[minmax(0,581fr)_minmax(0,579fr)] xl:gap-20"
        >
          <div className="flex flex-col">
            <SectionHeader
              align="start"
              titleId="how-it-works-title"
              title="How It Works"
            />

            {/* Segmented switch: white pill slides between the two flows. */}
            <Tabs.List
              aria-label="Show steps for"
              className="mt-8 grid grid-cols-2 self-stretch rounded-full bg-[var(--color-surface-subtle)] p-1 sm:self-start"
            >
              {modes.map((m) => (
                <Tabs.Trigger
                  key={m}
                  value={m}
                  className="relative isolate cursor-pointer rounded-full px-6 py-2.5 text-base leading-6 font-semibold whitespace-nowrap text-[var(--color-text-secondary)] transition-colors duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)] data-[state=active]:text-[var(--color-neutral-charcoal)] data-[state=inactive]:hover:text-[var(--color-neutral-charcoal)]"
                >
                  {mode === m && (
                    <motion.span
                      layoutId="how-it-works-pill"
                      aria-hidden
                      className="absolute inset-0 -z-10 rounded-full bg-[var(--color-neutral-white)] shadow-[0_1px_2px_oklch(0_0_0/0.06),0_4px_12px_-4px_oklch(0_0_0/0.12)]"
                    />
                  )}
                  {flows[m].label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {/* Both flows stay mounted in one cell, so the column is always as tall as
                the 4-step flow and switching never shifts the page. */}
            <div className="mt-8 grid lg:mt-10">
              {modes.map((m) => (
                <Tabs.Content
                  key={m}
                  value={m}
                  forceMount
                  className="outline-none [grid-area:1/1] data-[state=inactive]:invisible"
                >
                  <motion.ol
                    initial={false}
                    animate={mode === m ? "show" : "hide"}
                    variants={list}
                    className="flex flex-col gap-4 lg:gap-[30px]"
                  >
                    {flows[m].steps.map((s, i) => (
                      <motion.li
                        key={s.title}
                        variants={item}
                        className={cn(
                          "flex items-center gap-4 lg:gap-6",
                          // Desktop zigzag from Figma: 01 left, 02 right, 03 left...
                          i % 2 === 1 && "lg:flex-row-reverse",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "w-10 shrink-0 text-[2rem] leading-none font-medium text-[var(--color-step-number)] sm:w-20 sm:text-[4rem] lg:w-[8.25rem] lg:text-[6.75rem]",
                            i % 2 === 1 && "lg:text-right",
                          )}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <StepCard step={s} />
                      </motion.li>
                    ))}
                  </motion.ol>
                </Tabs.Content>
              ))}
            </div>
          </div>

          {/* One video per flow; switching cross-fades it. Fixed Figma ratio, centred beside
              the steps so the 4-step flow does not stretch it. */}
          <div
            ref={videoBoxRef}
            className="relative aspect-[4/3] sm:aspect-[16/9] xl:aspect-[579/490] xl:self-center"
          >
            <AnimatePresence initial={false}>
              <Fade key={mode}>
                <VideoCard
                  {...flow.video}
                  label={`Play video: ${flow.video.title}`}
                  sizes="(min-width: 1280px) 579px, 100vw"
                  playing={playing}
                  onHover={() => {
                    if (reduceMotion) return;
                    userPaused.current = false;
                    setPlaying(true);
                  }}
                  onToggle={() => {
                    userPaused.current = playing;
                    setPlaying(!playing);
                  }}
                />
              </Fade>
            </AnimatePresence>
          </div>
        </Tabs.Root>
      </MotionConfig>
    </section>
  );
}

/** Cross-fade layer; the outgoing copy is inert so it can't be clicked or announced while it fades. */
function Fade({ children }: { children: React.ReactNode }) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
      className="absolute inset-0"
    >
      {children}
    </motion.div>
  );
}

function StepCard({ step }: { step: Step }) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-4 rounded-[20px] bg-[var(--color-neutral-white)] p-4 shadow-[0_0_0_1px_var(--color-card-border),0_16px_32px_-12px_oklch(0_0_0/0.1)] sm:p-6 xl:shadow-[0_0_0_1px_var(--color-card-border),0_32px_64px_-16px_oklch(0_0_0/0.2)]">
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center rounded-full sm:size-14"
        style={{
          backgroundColor: `color-mix(in oklab, ${step.hue} 10%, white)`,
        }}
      >
        <Image src={step.icon} alt="" width={24} height={24} />
      </span>
      <div className="min-w-0 self-center">
        <h3 className="text-lg leading-[1.25] font-medium text-[var(--color-neutral-charcoal)] sm:text-2xl">
          {step.title}
        </h3>
        <p className="mt-1 text-sm leading-[1.5] text-[var(--color-text-secondary)] sm:text-base sm:leading-6">
          {step.description}
        </p>
      </div>
    </div>
  );
}
