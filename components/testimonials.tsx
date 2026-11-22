"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { ArrowGlyph } from "@/components/arrow-link-button";
import { SectionHeader } from "@/components/section-header";
import { canOptimizeImage } from "@/lib/media";
import type { Testimonial, TestimonialsBlock } from "@/lib/site-content";
import { useRefreshExpiredPageMedia } from "@/lib/use-refresh-expired-page-media";
import { useSaveData } from "@/lib/use-save-data";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 3000;
const SWIPE_PX = 50;
const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -12 }),
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-inverse)]";

export function Testimonials({ content }: { content: TestimonialsBlock }) {
  const items = content.items;
  const onMediaError = useRefreshExpiredPageMedia();
  const count = items.length;
  // One card has nothing to rotate to: no autoplay, no pause control, no arrows.
  const multi = count > 1;
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [flipped, setFlipped] = useState(false);
  // Any click on arrows/card stops rotation for good; the pause button toggles it.
  const [stopped, setStopped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const swiped = useRef(false);
  const inView = useInView(carouselRef, { amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const playVideo = inView && !reduceMotion && !stopped;

  const running =
    multi &&
    !reduceMotion &&
    !stopped &&
    inView &&
    !hovered &&
    !focused &&
    !flipped;
  const t = items[index];

  // The outgoing slide stays mounted while it fades out, so its video is paused
  // here, before the incoming slide's own effect starts playing.
  useLayoutEffect(() => {
    carouselRef.current
      ?.querySelectorAll<HTMLVideoElement>("video")
      .forEach((v) => v.pause());
  }, [index]);

  // One timeout per slide, so every testimonial gets the full 3s after a pause.
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => {
      setDir(1);
      setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [running, index, count]);

  const go = (step: number) => {
    rememberFocus();
    setStopped(true);
    setDir(step);
    setIndex((i) => (i + step + count) % count);
    setFlipped(false);
  };

  const flip = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    rememberFocus();
    setStopped(true);
    setFlipped((f) => !f);
  };

  // Flipping makes the focused face inert, which drops focus to <body>.
  // Hand focus to the matching control on the face that's now showing.
  const focusKey = useRef<string | undefined>(undefined);
  const rememberFocus = () => {
    focusKey.current = (document.activeElement as HTMLElement | null)?.dataset
      .focusKey;
  };
  useEffect(() => {
    const key = focusKey.current;
    focusKey.current = undefined;
    if (!key) return;
    carouselRef.current
      ?.querySelector<HTMLElement>(
        `[aria-hidden="false"] [data-focus-key="${key}"]`,
      )
      ?.focus({ preventScroll: true });
  }, [flipped]);

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-title"
      className="scroll-mt-[calc(var(--navbar-top-offset)+var(--navbar-height))] bg-[var(--color-neutral-white)] px-6 py-14 sm:py-16 lg:py-[88px]"
    >
      <div className="mx-auto w-full max-w-[77.5rem]">
        <SectionHeader
          align="start"
          titleId="testimonials-title"
          title={content.title}
        />

        <MotionConfig
          reducedMotion="user"
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        >
          {/* Hover/focus pause rotation; swipe (touch only) changes slides.
              touch-pan-y keeps vertical page scrolling native on phones. */}
          <motion.div
            ref={carouselRef}
            role="group"
            aria-roledescription="carousel"
            aria-label="Testimonials"
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            // Each gesture starts clean; a swipe only swallows its own trailing click.
            onPointerDown={() => (swiped.current = false)}
            onFocus={() => setFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setFocused(false);
            }}
            onPanEnd={(e, info) => {
              if ((e as PointerEvent).pointerType === "mouse") return;
              const { x, y } = info.offset;
              if (Math.abs(x) < SWIPE_PX || Math.abs(x) < Math.abs(y)) return;
              swiped.current = true;
              go(x < 0 ? 1 : -1);
            }}
            className="relative mt-10 grid touch-pan-y gap-4 sm:gap-6 lg:grid-cols-[minmax(0,716fr)_minmax(0,500fr)]"
          >
            {/* Keyboard/screen-reader pause control (WCAG 2.2.2); mouse users pause by hovering. */}
            {multi && (
              <button
                type="button"
                onClick={() => setStopped((s) => !s)}
                className={cn(
                  "sr-only z-10 rounded-full bg-[var(--color-neutral-white)] px-4 py-2 text-sm font-semibold text-[var(--color-neutral-charcoal)] focus:not-sr-only focus:absolute focus:top-4 focus:right-4 motion-reduce:hidden",
                  focusRing,
                )}
              >
                <HugeiconsIcon
                  icon={stopped ? PlayIcon : PauseIcon}
                  aria-hidden
                  className="mr-2 inline size-4 align-[-3px]"
                  strokeWidth={2}
                />
                {stopped ? "Start slide show" : "Pause slide show"}
              </button>
            )}

            <div className="cursor-pointer [perspective:1600px]">
              <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ type: "spring", duration: 0.6, bounce: 0 }}
                onClick={flip}
                className="grid h-full [transform-style:preserve-3d]"
              >
                <Face hidden={flipped}>
                  {/* Live region announces manual changes only, never auto-rotation. */}
                  <div
                    aria-live={running ? "off" : "polite"}
                    aria-atomic
                    className="flex w-full flex-1 items-center justify-center"
                  >
                    <span className="sr-only">
                      Testimonial {index + 1} of {count}
                    </span>
                    <AnimatePresence mode="wait" initial={false} custom={dir}>
                      <motion.div
                        key={index}
                        custom={dir}
                        variants={slide}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="flex w-full flex-col items-center gap-4 sm:gap-10"
                      >
                        <Byline t={t} />
                        <button
                          type="button"
                          aria-expanded={false}
                          data-focus-key="flip"
                          className={cn(
                            "max-w-[33rem] cursor-pointer rounded-lg text-xl leading-[1.3] font-medium text-balance text-[var(--color-neutral-white)] sm:text-[2rem] sm:leading-[1.2] lg:text-[2.5rem]",
                            focusRing,
                          )}
                        >
                          <span className="sr-only">Read full review: </span>
                          &ldquo;{t.quote}&rdquo;
                        </button>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  {multi && <Arrows onStep={go} />}
                </Face>

                <Face hidden={!flipped} back>
                  <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 sm:gap-6">
                    <Byline t={t} />
                    <button
                      type="button"
                      aria-expanded
                      data-focus-key="flip"
                      className={cn(
                        "grid max-w-[33rem] cursor-pointer rounded-lg text-left",
                        focusRing,
                      )}
                    >
                      {/* Every comment is stacked in one cell so the card is always as tall as
                        the longest one: no height jump between slides or when flipping. */}
                      {items.map((x, i) => (
                        <span
                          key={i}
                          aria-hidden={i !== index || undefined}
                          className={cn(
                            "text-sm leading-[1.5] font-semibold text-pretty text-[var(--color-neutral-white)] [grid-area:1/1] sm:text-xl sm:leading-[1.5]",
                            i !== index && "invisible",
                          )}
                        >
                          {x.comment}
                        </span>
                      ))}
                    </button>
                  </div>
                  {/* Phones: tap the card to go back; arrows return on the front. Keeps the card short. */}
                  {multi && <Arrows onStep={go} className="hidden sm:flex" />}
                </Face>
              </motion.div>
            </div>

            {/* Phone: photo first, above the card. lg: right column, card height. */}
            <div className="relative order-first aspect-[16/9] overflow-hidden rounded-[20px] outline-1 -outline-offset-1 outline-[oklch(0_0_0/0.1)] lg:order-none lg:aspect-auto lg:min-h-[500px]">
              <AnimatePresence initial={false}>
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={t.photo}
                    alt=""
                    fill
                    {...(!canOptimizeImage(t.photo) && { unoptimized: true })}
                    sizes="(min-width: 1024px) 500px, 100vw"
                    onError={onMediaError}
                    className="object-cover object-[50%_30%]"
                  />
                  {t.video && (
                    <SlideVideo
                      src={t.video}
                      poster={t.photo}
                      play={playVideo}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </MotionConfig>
      </div>
    </section>
  );
}

// Decorative loop over the photo. The photo stays underneath as the poster,
// the loading state, and the fallback when autoplay is blocked.
function SlideVideo({
  src,
  poster,
  play,
}: {
  src: string;
  poster: string;
  play: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const saveData = useSaveData();
  const onMediaError = useRefreshExpiredPageMedia();
  useEffect(() => {
    const video = ref.current;
    if (!video || !play || saveData) return;
    // Autoplay can be refused (power saving, data saver); the poster stays.
    Promise.resolve(video.play()).catch(() => {});
    return () => video.pause();
  }, [play, saveData]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload={saveData ? "none" : "metadata"}
      disablePictureInPicture
      aria-hidden
      onError={onMediaError}
      className="absolute inset-0 size-full object-cover object-[50%_30%]"
    />
  );
}

function Face({
  hidden,
  back,
  children,
}: {
  hidden: boolean;
  back?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      inert={hidden}
      aria-hidden={hidden}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-[20px] bg-[var(--color-surface-inverse)] px-5 py-6 text-center [backface-visibility:hidden] [grid-area:1/1] sm:gap-10 sm:px-12 sm:py-8 lg:min-h-[500px] lg:py-10",
        back && "[transform:rotateY(180deg)] sm:gap-6",
      )}
    >
      {children}
    </div>
  );
}

function Byline({ t }: { t: Testimonial }) {
  return (
    <p className="flex flex-col items-center gap-x-4 text-sm leading-[1.5] font-semibold sm:flex-row sm:flex-wrap sm:justify-center sm:text-xl">
      <span className="text-[var(--color-neutral-white)]">{t.name}</span>
      <span
        aria-hidden
        className="hidden size-[5px] rounded-full bg-[var(--color-neutral-gray)] sm:block"
      />
      <span className="text-[var(--color-neutral-gray)]">{t.role}</span>
    </p>
  );
}

function Arrows({
  onStep,
  className,
}: {
  onStep: (step: number) => void;
  className?: string;
}) {
  const base = cn(
    "grid size-12 place-items-center rounded-full transition-[background-color,scale] duration-150 ease-out active:scale-[0.96] sm:size-16",
    focusRing,
  );
  return (
    // Arrows sit inside the flippable card; stop clicks from also flipping it.
    <div
      className={cn("flex gap-4", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Previous testimonial"
        data-focus-key="prev"
        onClick={() => onStep(-1)}
        className={cn(
          base,
          "bg-[var(--color-neutral-white)] text-[var(--color-neutral-charcoal)] hover:bg-[color-mix(in_oklab,var(--color-neutral-white)_88%,var(--color-primary-core))]",
        )}
      >
        <ArrowGlyph className="size-4 -rotate-135 bg-current" />
      </button>
      <button
        type="button"
        aria-label="Next testimonial"
        data-focus-key="next"
        onClick={() => onStep(1)}
        className={cn(
          base,
          "bg-[var(--color-primary-core)] text-[var(--color-neutral-white)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-pressed)]",
        )}
      >
        <ArrowGlyph className="size-4 rotate-45 bg-current" />
      </button>
    </div>
  );
}
