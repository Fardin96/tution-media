"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { SectionHeader } from "@/components/section-header";
import { VideoCard } from "@/components/video-card";
import { showcase, type CommentShowcase } from "@/lib/showcase";
import { cn } from "@/lib/utils";

// Track padding lines the first card up with the 1240px content column while the
// strip itself runs to the viewport edge, like the Figma frame.
const EDGE = "max(1.5rem, calc((100% - 77.5rem) / 2))";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)] focus-visible:ring-offset-2";

export function TutorShowcase() {
  const trackRef = useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion();
  const [playingId, setPlayingId] = useState<string | null>(null);
  // A tap-to-pause wins over autoplay until the section leaves view.
  const userPaused = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: false });
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** First video card at least half visible inside the strip. */
  const firstVisibleVideo = useCallback(() => {
    const track = trackRef.current;
    if (!track) return null;
    const t = track.getBoundingClientRect();
    for (const el of track.querySelectorAll<HTMLElement>("[data-video-id]")) {
      const r = el.getBoundingClientRect();
      const shown = Math.min(r.right, t.right) - Math.max(r.left, t.left);
      if (shown >= r.width / 2) return el.dataset.videoId ?? null;
    }
    return null;
  }, []);

  const isVisible = (id: string) => {
    const track = trackRef.current;
    const el = track?.querySelector<HTMLElement>(`[data-video-id="${id}"]`);
    if (!track || !el) return false;
    const t = track.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return Math.min(r.right, t.right) - Math.max(r.left, t.left) >= r.width / 2;
  };

  // Section in view: first visible video plays. Out of view: everything pauses.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          userPaused.current = false;
          setPlayingId(null);
        } else if (!reduceMotion && !userPaused.current) {
          setPlayingId(firstVisibleVideo());
        }
      },
      { threshold: 0.4 },
    );
    io.observe(track);
    return () => io.disconnect();
  }, [reduceMotion, firstVisibleVideo]);

  // Arrow enabled/disabled state; ResizeObserver also fires once on mount.
  const updateEdges = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    setEdges({
      start: t.scrollLeft <= 1,
      end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 1,
    });
  }, []);
  useEffect(() => {
    const t = trackRef.current;
    if (!t) return;
    const ro = new ResizeObserver(updateEdges);
    ro.observe(t);
    return () => ro.disconnect();
  }, [updateEdges]);

  const onScroll = () => {
    updateEdges();
    // When scrolling settles, a playing card that left the strip hands over to
    // the first visible one (unless the user paused).
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (reduceMotion || userPaused.current) return;
      setPlayingId((id) => (id && isVisible(id) ? id : firstVisibleVideo()));
    }, 150);
  };

  const step = (dir: number) => {
    const t = trackRef.current;
    const card = t?.querySelector("li");
    if (!t || !card) return;
    const gap = parseFloat(getComputedStyle(t).columnGap) || 0;
    t.scrollBy({
      left: dir * (card.getBoundingClientRect().width + gap),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <section
      id="tutors"
      aria-labelledby="tutors-title"
      className="scroll-mt-[calc(var(--navbar-top-offset)+var(--navbar-height))] bg-[var(--color-neutral-white)] py-14 sm:py-16 lg:py-[88px]"
    >
      <MotionConfig reducedMotion="user">
        <div className="mx-auto flex w-full max-w-[77.5rem] items-end justify-between gap-6 px-6 xl:px-0">
          <SectionHeader
            align="start"
            titleId="tutors-title"
            title="Top Tutor portfolio Showcase"
          />
          {/* Phones swipe; arrows from sm up. No auto-scrolling. */}
          <div className="hidden shrink-0 gap-4 sm:flex">
            <StripArrow
              dir={-1}
              disabled={edges.start}
              onClick={() => step(-1)}
            />
            <StripArrow dir={1} disabled={edges.end} onClick={() => step(1)} />
          </div>
        </div>

        <ul
          ref={trackRef}
          aria-label="Tutor portfolios"
          onScroll={onScroll}
          style={{ paddingInline: EDGE, scrollPaddingInline: EDGE }}
          className="mt-10 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto sm:gap-6 [&::-webkit-scrollbar]:hidden"
        >
          {showcase.map((item) => (
            <li
              key={item.id}
              data-video-id={item.kind === "video" ? item.id : undefined}
              className="aspect-[461/603] w-[85%] shrink-0 snap-start sm:w-[22rem] lg:w-[28.8125rem]"
            >
              {item.kind === "video" ? (
                <VideoCard
                  title={item.name}
                  subtitle={item.subject}
                  thumbnail={item.thumbnail}
                  video={item.video}
                  label={`Play ${item.name}'s video, ${item.subject}`}
                  sizes="(min-width: 1024px) 461px, (min-width: 640px) 352px, 80vw"
                  playing={playingId === item.id}
                  onHover={() => {
                    if (reduceMotion) return;
                    userPaused.current = false;
                    setPlayingId(item.id);
                  }}
                  onToggle={() => {
                    const pausing = playingId === item.id;
                    userPaused.current = pausing;
                    setPlayingId(pausing ? null : item.id);
                  }}
                />
              ) : (
                <CommentCard item={item} />
              )}
            </li>
          ))}
        </ul>
      </MotionConfig>
    </section>
  );
}

function CommentCard({ item }: { item: CommentShowcase }) {
  return (
    <article className="flex size-full flex-col overflow-hidden rounded-[20px] bg-[var(--color-surface-inverse)]">
      <div className="relative shrink-0 basis-[35%] sm:basis-1/2">
        <Image
          src={item.thumbnail}
          alt=""
          fill
          sizes="(min-width: 1024px) 461px, (min-width: 640px) 352px, 80vw"
          className="object-cover object-top"
        />
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-xl leading-[1.25] font-semibold text-[var(--color-neutral-white)] sm:text-2xl">
          {item.name}
        </p>
        <p className="mt-1 line-clamp-2 text-sm leading-[1.5] text-[var(--color-neutral-gray)] sm:line-clamp-none sm:text-base">
          {item.subject} · {item.university}
        </p>
        <p className="mt-3 line-clamp-4 text-sm leading-[1.5] text-pretty text-[var(--color-neutral-white)] sm:mt-4 sm:line-clamp-none sm:text-base">
          &ldquo;{item.comment}&rdquo;
        </p>
      </div>
    </article>
  );
}

function StripArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={dir < 0 ? "Previous tutors" : "Next tutors"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-16 place-items-center rounded-full transition-[background-color,opacity,scale] duration-150 ease-out active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
        dir < 0
          ? "border border-[var(--color-card-border)] bg-[var(--color-neutral-white)] text-[var(--color-neutral-charcoal)] hover:bg-[var(--color-neutral-off-white)]"
          : "bg-[var(--color-primary-core)] text-[var(--color-neutral-white)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-pressed)]",
        focusRing,
      )}
    >
      <HugeiconsIcon
        icon={dir < 0 ? ArrowLeft02Icon : ArrowRight02Icon}
        aria-hidden
        className="size-6"
        strokeWidth={2}
      />
    </button>
  );
}
