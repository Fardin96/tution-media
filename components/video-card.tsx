"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { canOptimizeImage } from "@/lib/media";
import { useRefreshExpiredPageMedia } from "@/lib/use-refresh-expired-page-media";
import { useSaveData } from "@/lib/use-save-data";
import { cn } from "@/lib/utils";

type VideoCardProps = {
  title: string;
  subtitle: string;
  thumbnail: string;
  /** Leave undefined until the file exists; the card then only toggles its play state. */
  video?: string;
  playing: boolean;
  onHover: () => void;
  onToggle: () => void;
  /** Accessible name, e.g. "Play Tanvir Ahmed's video". */
  label: string;
  sizes: string;
  className?: string;
};

/** Thumbnail/video tile with a tap-to-play toggle. Used by the tutor showcase and How it works. */
export function VideoCard({
  title,
  subtitle,
  thumbnail,
  video,
  playing,
  onHover,
  onToggle,
  label,
  sizes,
  className,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLButtonElement>(null);
  const saveData = useSaveData();
  const onMediaError = useRefreshExpiredPageMedia();
  // The <video> mounts near the viewport or once it is wanted. Until it has loaded its
  // first frame, the thumbnail Image underneath shows through.
  const near = useInView(boxRef, { once: true, margin: "200px" });
  const mounted = near || playing;
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // play() rejects if the browser blocks it; the thumbnail simply stays.
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing, video, mounted]);

  return (
    <button
      ref={boxRef}
      type="button"
      aria-pressed={playing}
      aria-label={label}
      onClick={onToggle}
      onPointerEnter={(e) =>
        e.pointerType === "mouse" && !saveData && onHover()
      }
      // No double-tap-to-zoom: quick play→pause taps must both register.
      className={cn(
        "relative block size-full cursor-pointer touch-manipulation overflow-hidden rounded-[20px] bg-[var(--color-surface-inverse)] text-left outline-1 -outline-offset-1 outline-[oklch(0_0_0/0.1)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)] focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      <Image
        src={thumbnail}
        alt=""
        fill
        {...(!canOptimizeImage(thumbnail) && { unoptimized: true })}
        sizes={sizes}
        onError={onMediaError}
        className="object-cover"
      />
      {video && mounted && (
        <video
          key={video}
          ref={videoRef}
          src={video}
          muted
          loop
          playsInline
          // No poster: it would download the original a second time. play() starts the load.
          preload="none"
          onLoadedData={() => setLoadedSrc(video)}
          onError={onMediaError}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out",
            loadedSrc === video ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      {/* Scrim so white text stays readable on any frame. */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,oklch(0_0_0/0.72),transparent)]"
      />
      <span className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 sm:inset-x-6 sm:bottom-6">
        <span className="min-w-0">
          <span className="block text-xl leading-[1.25] font-semibold text-[var(--color-neutral-white)] sm:text-2xl">
            {title}
          </span>
          <span className="mt-1 block text-sm leading-[1.5] text-[oklch(1_0_0/0.85)] sm:text-base">
            {subtitle}
          </span>
        </span>
        <PlayState playing={playing} />
      </span>
    </button>
  );
}

/** Play/pause glyph cross-fade (better-ui icon recipe: scale .25, blur 4px, spring 0.3, no bounce). */
function PlayState({ playing }: { playing: boolean }) {
  const swap = {
    initial: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
    transition: { type: "spring" as const, duration: 0.3, bounce: 0 },
  };
  return (
    <span
      aria-hidden
      className="relative grid size-12 shrink-0 place-items-center rounded-full bg-[var(--color-neutral-white)] text-[var(--color-primary-deep)] sm:size-14"
    >
      <AnimatePresence initial={false}>
        {playing ? (
          <motion.span key="pause" {...swap} className="absolute flex gap-1">
            <span className="h-4 w-1 rounded-full bg-current" />
            <span className="h-4 w-1 rounded-full bg-current" />
          </motion.span>
        ) : (
          <motion.span
            key="play"
            {...swap}
            // Triangle's visual centre sits left of its box; nudge it right.
            className="absolute ml-0.5 size-[18px] bg-current [mask:url(/assets/ic/ic-play.png)_center/contain_no-repeat]"
          />
        )}
      </AnimatePresence>
    </span>
  );
}
