import type * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { secondaryButton } from "@/components/profile/styles";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";

const WASH = [
  "radial-gradient(60% 50% at 10% 0%, color-mix(in oklab, var(--color-primary-core) 16%, transparent), transparent 70%)",
  "radial-gradient(50% 40% at 95% 10%, color-mix(in oklab, var(--color-mesh-glow) 45%, transparent), transparent 70%)",
  "radial-gradient(40% 40% at 80% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

/**
 * Shared chrome for the applications and browse pages: logo row, optional header action, then the content column.
 * Public pages pass `signedIn={false}`: the logo goes home and the bell, which needs an account, is left out.
 */
export function PageFrame({
  headerAction,
  signedIn = true,
  children,
}: {
  headerAction?: React.ReactNode;
  signedIn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main
      className="relative isolate flex min-h-dvh flex-col bg-[var(--color-neutral-off-white)]"
      style={{ backgroundImage: WASH }}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <Link
          href={signedIn ? "/dashboard" : "/"}
          aria-label="Masters Hub Home"
          data-home-link
        >
          <Image
            src="/assets/ic-demo/Icon-blue.png"
            alt="Masters Hub"
            width={860}
            height={220}
            preload
            className="h-10 w-auto sm:h-12"
          />
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {signedIn && <NotificationBell />}
          {headerAction}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
        {children}
      </div>
    </main>
  );
}

/** The header's secondary link, e.g. "My applications". */
export function HeaderLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(secondaryButton, "min-h-10 px-4")}>
      <LinkPendingLabel>{children}</LinkPendingLabel>
    </Link>
  );
}
