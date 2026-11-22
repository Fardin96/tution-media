"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/components/profile/styles";
import {
  AdminDialog,
  LoadMore,
  QueryState,
  Section,
  StatusPill,
} from "@/components/admin/admin-ui";
import {
  ReviewNoteForm,
  type ReviewSubmit,
} from "@/components/admin/review-dialog";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { formatBytes } from "@/lib/files";
import { formatDateTime } from "@/lib/admin";
import { issueText, repeatedIssues } from "@/lib/admin-moderation";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  blockScopeText,
  eventTitle,
  purposeText,
  useLiftUploadBlock,
  useSetUploadBlock,
  useUploadHistory,
  validateBlockScope,
  type UploadBlockView,
  type UploadReviewEvent,
} from "@/lib/admin-uploads";

/** The account's upload status, its issue summary and its upload history. Hidden for admin accounts. */
export function AccountUploadsSection({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const query = useUploadHistory(accountId);
  const [dialog, setDialog] = useState<"pause" | "resume" | null>(null);
  const setBlock = useSetUploadBlock(accountId);
  const liftBlock = useLiftUploadBlock(accountId);

  const first = query.data?.pages[0];
  const block = first?.block ?? null;
  const summary = first?.summary;
  const events = query.data?.pages.flatMap((page) => page.events) ?? [];

  return (
    <div id="uploads" className="scroll-mt-24">
      <Section title="Uploads">
        <QueryState
          query={query}
          isEmpty={false}
          loadingLabel="Loading uploads"
          errorText="Couldn't load upload history."
          emptyText={null}
        >
          <div className="grid gap-4">
            <div className="grid min-w-0 gap-3 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                {block ? (
                  <StatusPill tone="warning">Uploads paused</StatusPill>
                ) : (
                  <StatusPill tone="success">Uploads allowed</StatusPill>
                )}
              </div>

              {block && <BlockDetails block={block} />}

              <div className="flex flex-wrap gap-2">
                {block ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setDialog("pause")}
                      className={cn(secondaryButton, "min-h-11")}
                    >
                      Change pause
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog("resume")}
                      className={cn(primaryButton, "min-h-11")}
                    >
                      Resume uploads
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDialog("pause")}
                    className={cn(secondaryButton, "min-h-11")}
                  >
                    Pause uploads
                  </button>
                )}
              </div>
            </div>

            {summary && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--color-neutral-charcoal)]">
                <p className="tabular-nums">
                  {issueText(summary.recentIssues) ?? "No issues in 30 days"}
                </p>
                {repeatedIssues(summary.recentIssues) && (
                  <StatusPill tone="warning">Repeated issues</StatusPill>
                )}
                <p className="text-[var(--color-text-secondary)] tabular-nums">
                  {`${summary.total} ${summary.total === 1 ? "action" : "actions"} in total`}
                </p>
              </div>
            )}

            {query.isSuccess && events.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No upload history yet.
              </p>
            ) : (
              <ul className="grid gap-3">
                {events.map((event, index) => (
                  <HistoryItem
                    key={event.id}
                    event={event}
                    className={enterClass}
                    style={enterStyle(index)}
                  />
                ))}
              </ul>
            )}

            <LoadMore query={query} />
          </div>
        </QueryState>
      </Section>

      <AdminDialog
        open={dialog === "pause"}
        onOpenChange={(open) => setDialog(open ? "pause" : null)}
        title={block ? "Change pause" : "Pause uploads?"}
        description={`Choose what ${accountName} can't upload. They are told when it changes.`}
        busy={setBlock.isPending}
      >
        <PauseForm
          block={block}
          saving={setBlock.isPending}
          onCancel={() => setDialog(null)}
          onSubmit={({ note, noteVisible }, scope) =>
            setBlock.mutate(
              {
                blocksVideos: scope.videos,
                blocksDocuments: scope.documents,
                note: note ?? "",
                noteVisible,
              },
              {
                onSuccess: () => {
                  toastSuccess(block ? "Pause updated" : "Uploads paused");
                  setDialog(null);
                },
                onError: (err) =>
                  toastError(
                    block
                      ? "Couldn't update the pause."
                      : "Couldn't pause uploads.",
                    err,
                  ),
              },
            )
          }
        />
      </AdminDialog>

      <AdminDialog
        open={dialog === "resume"}
        onOpenChange={(open) => setDialog(open ? "resume" : null)}
        title="Resume uploads?"
        description={`${accountName} can upload again right away.`}
        busy={liftBlock.isPending}
      >
        <ReviewNoteForm
          noteLabel="Note"
          noteRequired={false}
          submitLabel="Resume uploads"
          saving={liftBlock.isPending}
          onCancel={() => setDialog(null)}
          onSubmit={({ note, noteVisible }) =>
            liftBlock.mutate(
              { note, noteVisible },
              {
                onSuccess: () => {
                  toastSuccess("Uploads resumed");
                  setDialog(null);
                },
                onError: (err) => toastError("Couldn't resume uploads.", err),
              },
            )
          }
        />
      </AdminDialog>
    </div>
  );
}

function BlockDetails({ block }: { block: UploadBlockView }) {
  const scope = blockScopeText(block);
  const who = block.blockedBy?.name ?? "An admin";
  return (
    <div className="grid min-w-0 gap-2">
      {scope && (
        <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
          {scope}
        </p>
      )}
      {block.note && (
        <p className="text-sm text-pretty break-words text-[var(--color-neutral-charcoal)]">
          {block.note}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-secondary)]">
        {!block.noteVisible && (
          <span className="font-semibold">Hidden from the user</span>
        )}
        <span className="tabular-nums">
          {`Paused by ${who} ${formatDateTime(block.blockedAt)}`}
        </span>
      </div>
    </div>
  );
}

function HistoryItem({
  event,
  className,
  style,
}: {
  event: UploadReviewEvent;
  className?: string;
  style?: CSSProperties;
}) {
  const what = purposeText(event.purpose);
  const size = event.sizeBytes !== null ? formatBytes(event.sizeBytes) : null;
  return (
    <li
      className={cn(
        "grid min-w-0 gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4",
        className,
      )}
      style={style}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
          {eventTitle(event)}
        </p>
        <time
          dateTime={event.createdAt}
          className="text-xs text-[var(--color-text-secondary)] tabular-nums"
        >
          {formatDateTime(event.createdAt)}
        </time>
      </div>

      {(what || event.fileName) && (
        <p className="grid min-w-0 gap-0.5 text-sm text-[var(--color-neutral-charcoal)]">
          {what && <span>{what}</span>}
          {event.fileName && (
            <span className="line-clamp-2 break-all text-[var(--color-text-secondary)]">
              {event.fileName}
              {size && <span className="tabular-nums">{` · ${size}`}</span>}
            </span>
          )}
        </p>
      )}

      {event.note && (
        <div className="grid gap-0.5">
          {!event.noteVisible && (
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Hidden from the user
            </span>
          )}
          <p className="text-sm text-pretty break-words text-[var(--color-neutral-charcoal)]">
            {event.note}
          </p>
        </div>
      )}

      <p className="text-xs text-[var(--color-text-secondary)]">
        {`By ${event.actor?.name ?? "An admin"}`}
      </p>
    </li>
  );
}

/** Pause or change a pause. The scope checkboxes start from the active block. */
function PauseForm({
  block,
  saving,
  onCancel,
  onSubmit,
}: {
  block: UploadBlockView | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (
    value: ReviewSubmit,
    scope: { videos: boolean; documents: boolean },
  ) => void;
}) {
  const [videos, setVideos] = useState(block?.blocksVideos ?? false);
  const [documents, setDocuments] = useState(block?.blocksDocuments ?? false);
  const scopeError = validateBlockScope(videos, documents);

  return (
    <ReviewNoteForm
      noteLabel="Reason"
      noteRequired
      danger
      submitLabel={block ? "Save" : "Pause uploads"}
      saving={saving}
      extraError={scopeError}
      extra={
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-semibold text-[var(--color-neutral-charcoal)]">
            What to pause
          </legend>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={videos}
              onChange={(e) => setVideos(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary-core)]"
            />
            <span className="text-[var(--color-neutral-charcoal)]">Videos</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={documents}
              onChange={(e) => setDocuments(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary-core)]"
            />
            <span className="text-[var(--color-neutral-charcoal)]">
              IDs and certificates (images and PDFs)
            </span>
          </label>
        </fieldset>
      }
      onCancel={onCancel}
      onSubmit={(value) => onSubmit(value, { videos, documents })}
    />
  );
}
