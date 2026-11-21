"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing, secondaryButton } from "@/components/profile/styles";
import { AdminDialog, QueryState } from "@/components/admin/admin-ui";
import { useSiteMedia } from "@/components/admin/site-content/media";
import {
  agreedText,
  sourceKey,
  useSiteSources,
  type AdminSiteSource,
  type SourceList,
} from "@/lib/admin-site-content";
import { fileRefId } from "@/lib/site-content-schema";

// Adds a card from a user's submission. The dialog lists the approved submissions for one card
// list, and each pick copies the submission into the draft with its `source`, so the API can take
// the card off the landing when the submission goes away.

const COPY: Record<SourceList, { description: string; empty: ReactNode }> = {
  testimonials: {
    description:
      "Approved student stories. Each one is copied into the list, and you can edit the copy.",
    empty:
      "No approved student stories yet. They appear here after you approve them in Stories.",
  },
  showcase: {
    description:
      "Approved tutor stories and videos the tutor agreed to show on the home page. Each one is copied into the list.",
    empty: (
      <>
        No approved tutor stories or videos yet.{" "}
        <Link
          href="/dashboard/admin/stories"
          className={cn(
            "inline-flex min-h-11 items-center rounded-sm font-semibold text-[var(--color-primary-core)] underline underline-offset-4",
            focusRing,
          )}
        >
          Open Stories
        </Link>
      </>
    ),
  },
};

/** "Add from submissions" beside a card list's Add button. Opens the dialog with the submissions. */
export function SourcePicker({
  list,
  full,
  added,
  onAdd,
}: {
  list: SourceList;
  /** The list is at its maximum, so the button is disabled. */
  full: boolean;
  /** Keys of the submissions already in the draft. */
  added: ReadonlySet<string>;
  /** Appends the card for a submission to the list. */
  onAdd: (source: AdminSiteSource) => void;
}) {
  const [open, setOpen] = useState(false);
  const { register } = useSiteMedia();

  function pick(source: AdminSiteSource) {
    // The submission's files show in the preview and the thumbnails until the editor closes.
    for (const [id, file] of Object.entries(source.media)) {
      register(id, {
        url: file.url,
        contentType: file.contentType,
        originalName: file.originalName,
      });
    }
    onAdd(source);
    setOpen(false);
    toast.success("Card added. Fill in any empty fields, then save.");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={full}
        className={secondaryButton}
      >
        Add from submissions
      </button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title="Add from submissions"
        description={COPY[list].description}
      >
        <SourceChoices list={list} added={added} onPick={pick} />
      </AdminDialog>
    </>
  );
}

/** The submissions for one list. Mounted only while the dialog is open, so it fetches on each open. */
function SourceChoices({
  list,
  added,
  onPick,
}: {
  list: SourceList;
  added: ReadonlySet<string>;
  onPick: (source: AdminSiteSource) => void;
}) {
  const query = useSiteSources(list, true);
  const rows = query.data?.sources ?? [];
  return (
    <QueryState
      query={query}
      isEmpty={rows.length === 0}
      loadingLabel="Loading submissions"
      errorText="Could not load the submissions."
      emptyText={COPY[list].empty}
      skeletonCount={2}
    >
      <ul className="grid gap-3">
        {rows.map((row) => {
          const key = sourceKey(row.source);
          return (
            <SourceRow
              key={key}
              source={row}
              added={added.has(key)}
              onPick={onPick}
            />
          );
        })}
      </ul>
    </QueryState>
  );
}

function SourceRow({
  source,
  added,
  onPick,
}: {
  source: AdminSiteSource;
  added: boolean;
  onPick: (source: AdminSiteSource) => void;
}) {
  const excerpt = source.headline || source.body || source.title || "No text";
  return (
    <li className="flex min-w-0 items-start gap-3 rounded-[16px] border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] p-3">
      <SourceThumb source={source} />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold break-words text-[var(--color-neutral-charcoal)]">
          {source.authorName}
          <span className="text-xs font-normal text-[var(--color-text-secondary)]">
            {source.role === "STUDENT" ? "Student" : "Tutor"}
          </span>
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          {agreedText(source.consentAt)}
        </p>
        <p className="line-clamp-2 text-sm break-words text-[var(--color-text-secondary)]">
          {excerpt}
        </p>
      </div>
      <button
        type="button"
        disabled={added}
        onClick={() => onPick(source)}
        className={cn(secondaryButton, "shrink-0")}
      >
        {added ? "Added" : "Add"}
      </button>
    </li>
  );
}

/** A 48px photo for a story, or a video badge for a tutor video. */
function SourceThumb({ source }: { source: AdminSiteSource }) {
  if (source.source.kind === "tutor_video") {
    return (
      <span
        aria-hidden="true"
        className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-[var(--color-primary-core)] text-[var(--color-neutral-white)]"
      >
        <Video className="size-5" />
      </span>
    );
  }
  const id = source.imageRef ? fileRefId(source.imageRef) : null;
  const url = id ? source.media[id]?.url : null;
  if (!url) {
    return (
      <span
        aria-hidden="true"
        className="size-12 shrink-0 rounded-[12px] bg-[var(--color-surface-subtle)]"
      />
    );
  }
  return (
    <Image
      src={url}
      alt=""
      width={48}
      height={48}
      unoptimized
      className="size-12 shrink-0 rounded-[12px] object-cover"
    />
  );
}

/**
 * The tag at the top of a card that came from a submission. A 400 on the card's source shows here.
 */
export function SourceNote({ name, error }: { name: string; error?: string }) {
  const who = name.trim();
  return (
    <div className="grid min-w-0 gap-2 rounded-[12px] bg-[var(--color-neutral-off-white)] p-3">
      <p className="w-fit max-w-full rounded-full bg-[var(--color-secondary-sky)] px-2.5 py-1 text-xs font-semibold break-words text-[var(--color-primary-deep)]">
        {who ? `From ${who}'s submission` : "From a submission"}
      </p>
      <p className="text-xs text-pretty text-[var(--color-text-secondary)]">
        If they delete it, or an admin rejects it, this card comes off the home
        page.
      </p>
      {error && (
        <p
          role="alert"
          className="text-sm font-medium text-[var(--color-semantic-error-text)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
