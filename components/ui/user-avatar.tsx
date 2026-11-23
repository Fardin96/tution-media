"use client";

import { useState } from "react";
import Image from "next/image";
import { isGoogleAvatar } from "@/lib/avatar";
import { signedUrlExpired, useRefreshExpiredMedia } from "@/lib/files";
import { canOptimizeImage } from "@/lib/media";
import { cn } from "@/lib/utils";

/** The first letter of the name, as the tutor cards have always shown it. */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/**
 * A person's photo, or their initial when there is no photo or it fails to load. Decorative:
 * the name is printed next to it on every page that uses it, so the image has no alt text.
 */
export function UserAvatar({
  src,
  name,
  size,
  className,
  onExpired,
}: {
  src?: string | null;
  name: string;
  size: number;
  className?: string;
  /** Called once per failed signed link, after the page's refetch is started. */
  onExpired?: () => void;
}) {
  // Remember which URL failed, not a flag: a new src (after an upload) gets its own try.
  const [failed, setFailed] = useState<string | null>(null);
  const refreshExpired = useRefreshExpiredMedia();

  if (src && src !== failed) {
    const google = isGoogleAvatar(src);
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        // Google serves its pictures to any origin and sends no-referrer for them.
        unoptimized={google || !canOptimizeImage(src)}
        referrerPolicy={google ? "no-referrer" : undefined}
        onError={(e) => {
          // A signed link runs out after an hour: refetch it too. Either way this src shows
          // initials until the refetch hands back a new URL, which gets its own try.
          if (signedUrlExpired(src)) {
            refreshExpired(e);
            onExpired?.();
          }
          setFailed(src);
        }}
        className={cn(
          "shrink-0 rounded-full object-cover outline-1 -outline-offset-1 outline-[oklch(0_0_0/0.1)]",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary-sky)] font-semibold text-[var(--color-primary-deep)]",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initialOf(name)}
    </span>
  );
}
