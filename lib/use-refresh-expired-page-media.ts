"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { signedUrlExpired } from "@/lib/files";

// Module-level: one refresh per page load, however many images fail.
let refreshed = false;

/**
 * Site content is cached, so a landing page can carry signed media links that have
 * expired. When one fails, re-render the route once to fetch fresh links.
 */
export function useRefreshExpiredPageMedia() {
  const router = useRouter();
  return useCallback(
    (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
      if (refreshed) return;
      const el = e.currentTarget;
      if (!signedUrlExpired(el.currentSrc || el.src)) return;
      refreshed = true;
      router.refresh();
    },
    [router],
  );
}
