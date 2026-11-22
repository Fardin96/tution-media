"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { ghostButton } from "@/components/profile/styles";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { profileApi } from "@/lib/profile";
import { cn } from "@/lib/utils";

const backClass = cn(ghostButton, "-ms-3 min-h-10 self-start px-3");

// Browser state read at render time. The server snapshot is "unknown", so the first
// client render matches the server HTML and the real value applies after hydration.
const noSubscribe = () => () => {};
const hasHistory = () => window.history.length > 1;
const hasHistoryOnServer = () => false;
const signedInNow = () => api.getTokens() !== null;
const signedInOnServer = () => false;

/** Where to go when there is no history: students browse tutors, everyone else goes home. */
export function useFallbackBack(): { href: string; label: string } {
  const signedIn = useSyncExternalStore(
    noSubscribe,
    signedInNow,
    signedInOnServer,
  );
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => profileApi.me(),
    enabled: signedIn,
    retry: false,
  });
  return me.data?.role === "STUDENT"
    ? { href: "/dashboard/find-tutors", label: "Find tutors" }
    : { href: "/", label: "Home" };
}

/** Goes back in history when there is some, otherwise to the fallback. */
export function ProfileBack() {
  const router = useRouter();
  const fallback = useFallbackBack();
  const canGoBack = useSyncExternalStore(
    noSubscribe,
    hasHistory,
    hasHistoryOnServer,
  );

  if (canGoBack) {
    return (
      <button type="button" onClick={() => router.back()} className={backClass}>
        <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        Back
      </button>
    );
  }
  return (
    <Link href={fallback.href} className={backClass}>
      <LinkPendingLabel>
        <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {fallback.label}
      </LinkPendingLabel>
    </Link>
  );
}
