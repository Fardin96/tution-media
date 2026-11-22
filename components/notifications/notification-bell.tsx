"use client";

import { useId, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  card,
  ghostButton,
  secondaryButton,
} from "@/components/profile/styles";
import SpinnerEllipsis from "@/components/shadcn-space/spinner/spinner-05";
import { PendingLabel } from "@/components/ui/pending-label";
import { toastError } from "@/lib/toast";
import {
  notificationHref,
  notificationText,
  relativeTime,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
  type AppNotification,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
} from "@/components/animate-ui/primitives/radix/popover";
import { enterClass, enterStyle } from "@/components/motion/enter";

const SKELETON_ROWS = 3;

const CONTENT = cn(
  card,
  "z-50 flex max-h-[min(28rem,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden p-2 text-[var(--color-neutral-charcoal)] outline-none",
);

const ITEM_FOCUS =
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--color-primary-core)]";

/** Header bell with an unread badge, opening a dropdown of the latest alerts. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Set when an item navigates, so Radix does not return focus to the bell on the page being left.
  const navigatingRef = useRef(false);

  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;
  const list = useNotifications(open);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const now = new Date();
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";

  function openItem(e: MouseEvent<HTMLAnchorElement>, n: AppNotification) {
    if (!n.readAt) {
      markRead.mutate(n.id, {
        onError: (err) => toastError("Couldn't mark that as read.", err),
      });
    }
    // New-tab and new-window clicks keep the browser's default behaviour; Link routes the rest client-side.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    navigatingRef.current = true;
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            secondaryButton,
            "relative size-10 min-h-10 shrink-0 px-0",
          )}
        >
          <Bell aria-hidden="true" className="size-5" />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-primary-core)] px-1 text-xs leading-none font-semibold text-[var(--color-neutral-white)] tabular-nums shadow-[0_0_0_2px_var(--color-neutral-white)]"
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverContent
          align="end"
          sideOffset={8}
          collisionPadding={16}
          aria-labelledby={headingId}
          className={CONTENT}
          onCloseAutoFocus={(e) => {
            if (!navigatingRef.current) return;
            e.preventDefault();
            navigatingRef.current = false;
          }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <h2
              id={headingId}
              ref={headingRef}
              tabIndex={-1}
              className="text-base font-semibold outline-none"
            >
              Notifications
            </h2>
            {/* Stays mounted while its request runs: the count drops to zero at once, but the button goes only once the refreshed count arrives. */}
            {(count > 0 || markAll.isPending) && (
              <button
                type="button"
                disabled={markAll.isPending}
                aria-busy={markAll.isPending || undefined}
                className={cn(ghostButton, "min-h-10 px-3")}
                onClick={() => {
                  markAll.mutate(undefined, {
                    onError: (err) =>
                      toastError("Couldn't mark everything as read.", err),
                  });
                  // Focus moves to the heading before the button is disabled, so focus stays inside the dialog.
                  headingRef.current?.focus();
                }}
              >
                <PendingLabel pending={markAll.isPending}>
                  Mark all as read
                </PendingLabel>
              </button>
            )}
          </div>

          <div
            aria-busy={list.isPending}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {list.isPending ? (
              <div className="grid gap-1">
                <span className="sr-only" role="status">
                  Loading notifications
                </span>
                {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <div
                    key={i}
                    aria-hidden="true"
                    className="h-14 animate-pulse rounded-[16px] bg-[var(--color-neutral-off-white)] motion-reduce:animate-none"
                  />
                ))}
              </div>
            ) : list.isError ? (
              <div className="flex flex-col items-start gap-3 px-3 py-6">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Couldn&apos;t load notifications.
                </p>
                <button
                  type="button"
                  onClick={() => list.refetch()}
                  disabled={list.isFetching}
                  aria-busy={list.isFetching || undefined}
                  className={cn(secondaryButton, "min-h-10 px-4")}
                >
                  <PendingLabel pending={list.isFetching}>
                    Try again
                  </PendingLabel>
                </button>
              </div>
            ) : list.data?.notifications.length ? (
              <ul className="grid gap-1">
                {list.data.notifications.map((n, i) => {
                  // Only this row shows the spinner: the other rows stay usable while one is marked.
                  const marking =
                    markRead.isPending && markRead.variables === n.id;
                  return (
                    <li key={n.id} className={enterClass} style={enterStyle(i)}>
                      <Link
                        href={notificationHref(n)}
                        onClick={(e) => openItem(e, n)}
                        aria-busy={marking || undefined}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-[16px] px-3 py-3 transition-colors duration-150 ease-out hover:bg-[var(--color-neutral-off-white)] motion-reduce:transition-none",
                          ITEM_FOCUS,
                          !n.readAt &&
                            "bg-[color-mix(in_oklab,var(--color-secondary-sky)_60%,transparent)] hover:bg-[var(--color-secondary-sky)]",
                        )}
                      >
                        {marking ? (
                          <SpinnerEllipsis className="mt-1 shrink-0 text-[var(--color-primary-core)]" />
                        ) : (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-1.5 size-2 shrink-0 rounded-full",
                              n.readAt
                                ? "bg-transparent"
                                : "bg-[var(--color-primary-core)]",
                            )}
                          />
                        )}
                        <span className="min-w-0 flex-1 text-sm text-pretty">
                          {!n.readAt && (
                            <span className="sr-only">Unread: </span>
                          )}
                          <span
                            className={cn(
                              n.readAt
                                ? "text-[var(--color-text-secondary)]"
                                : "font-semibold text-[var(--color-neutral-charcoal)]",
                            )}
                          >
                            {notificationText(n)}
                          </span>
                          {n.note && (
                            <span className="mt-1 block break-words text-[var(--color-text-secondary)]">
                              Note: {n.note}
                            </span>
                          )}
                        </span>
                        <time
                          dateTime={n.createdAt}
                          className="shrink-0 pt-0.5 text-xs text-[var(--color-text-secondary)] tabular-nums"
                        >
                          {relativeTime(n.createdAt, now)}
                        </time>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                Nothing new yet.
              </p>
            )}
          </div>
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
}
