"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  card,
  ghostButton,
  secondaryButton,
} from "@/components/profile/styles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  AdminPage,
  DetailList,
  FilterChips,
  LoadMore,
  QueryState,
  StatusPill,
  type PillTone,
} from "@/components/admin/admin-ui";
import {
  FILE_PURPOSES,
  FILE_STATUS_LABEL,
  PURPOSE_LABEL,
  summarizeStats,
  useAdminFileStats,
  useAdminFiles,
  useDeleteAdminFile,
  type AdminFile,
  type AdminFileFilters,
  type FileStatus,
} from "@/lib/admin-files";
import { formatDateTime } from "@/lib/admin";
import { openFile, formatBytes, type FilePurpose } from "@/lib/files";
import { toastError } from "@/lib/toast";

type PurposeView = "ALL" | FilePurpose;
type StatusView = "ALL" | FileStatus;

const PURPOSE_VIEWS: { value: PurposeView; label: string }[] = [
  { value: "ALL", label: "All" },
  ...FILE_PURPOSES.map((purpose) => ({
    value: purpose,
    label: PURPOSE_LABEL[purpose],
  })),
];

const STATUS_VIEWS: { value: StatusView; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UPLOADED", label: "Uploaded" },
  { value: "PENDING_UPLOAD", label: "Pending" },
  { value: "DELETED", label: "Deleted" },
];

const STATUS_TONE: Record<FileStatus, PillTone> = {
  UPLOADED: "success",
  PENDING_UPLOAD: "warning",
  DELETED: "neutral",
};

export function AdminFilesPage() {
  const [purpose, setPurpose] = useState<PurposeView>("ALL");
  const [status, setStatus] = useState<StatusView>("ALL");
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [deleting, setDeleting] = useState<AdminFile | null>(null);

  const filters: AdminFileFilters = {
    ...(purpose === "ALL" ? {} : { purpose }),
    ...(status === "ALL" ? {} : { status }),
    ...(onlyUnused ? { unattached: true } : {}),
  };
  const stats = useAdminFileStats();
  const query = useAdminFiles(filters);
  const remove = useDeleteAdminFile();
  const files = query.data?.pages.flatMap((page) => page.files) ?? [];
  const summaries = useMemo(
    () => summarizeStats(stats.data?.groups ?? []),
    [stats.data],
  );

  async function view(file: AdminFile) {
    try {
      await openFile(file.id);
    } catch (err) {
      toastError("Couldn't open the file.", err);
    }
  }

  function confirmDelete() {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("File deleted.");
        setDeleting(null);
      },
      onError: (err) => {
        setDeleting(null);
        toastError("Couldn't delete the file.", err);
      },
    });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Files"
      description="Every upload, with its purpose, owner and whether a record uses it."
    >
      <section aria-labelledby="file-stats-title" className="grid gap-3">
        <h2
          id="file-stats-title"
          className="text-base font-semibold text-[var(--color-neutral-charcoal)]"
        >
          Stored files
        </h2>
        <QueryState
          query={stats}
          isEmpty={!stats.data || stats.data.groups.length === 0}
          loadingLabel="Loading file totals"
          errorText="Couldn't load file totals."
          emptyText="No uploads yet."
          skeletonCount={1}
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {summaries.map((item) => (
              <li
                key={item.purpose}
                className={cn(card, "flex flex-col gap-1 p-4")}
              >
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {item.label}
                </p>
                <p className="text-2xl font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
                  {item.uploadedCount}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
                  {formatBytes(item.uploadedBytes)} uploaded
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)] tabular-nums">
                  {item.pendingCount} pending · {item.deletedCount} deleted
                </p>
              </li>
            ))}
          </ul>
        </QueryState>
      </section>

      <div className="grid gap-3">
        <FilterChips
          label="Purpose"
          value={purpose}
          options={PURPOSE_VIEWS}
          onChange={setPurpose}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <FilterChips
            label="Status"
            value={status}
            options={STATUS_VIEWS}
            onChange={setStatus}
          />
          <label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--color-neutral-charcoal)]">
            <input
              type="checkbox"
              checked={onlyUnused}
              onChange={(e) => setOnlyUnused(e.target.checked)}
              className="size-4 accent-[var(--color-primary-core)]"
            />
            Only unused
          </label>
        </div>
      </div>

      <QueryState
        query={query}
        isEmpty={files.length === 0}
        loadingLabel="Loading files"
        errorText="Couldn't load files."
        emptyText="No files match these filters."
      >
        <ul className="grid gap-4">
          {files.map((file) => (
            <li key={file.id}>
              <FileRow
                file={file}
                onView={() => void view(file)}
                onDelete={() => setDeleting(file)}
              />
            </li>
          ))}
        </ul>
        <LoadMore query={query} />
      </QueryState>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
        title="Delete this file?"
        actions={[
          {
            label: "Keep file",
            variant: "secondary",
            onSelect: () => setDeleting(null),
          },
          {
            label: remove.isPending ? "Deleting..." : "Delete file",
            variant: "primary",
            onSelect: confirmDelete,
          },
        ]}
      >
        {deleting && (
          <>
            <span className="font-semibold break-all">
              {deleting.fileName ?? "Unnamed file"}
            </span>{" "}
            is removed from storage. Nothing uses it, so no record changes.
          </>
        )}
      </ConfirmDialog>
    </AdminPage>
  );
}

function FileRow({
  file,
  onView,
  onDelete,
}: {
  file: AdminFile;
  onView: () => void;
  onDelete: () => void;
}) {
  const canView = file.status === "UPLOADED";
  const canDelete = !file.inUse && file.status !== "DELETED";

  return (
    <article className={cn(card, "grid gap-4 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-semibold text-[var(--color-neutral-charcoal)]",
              !file.fileName &&
                "font-normal text-[var(--color-text-secondary)] italic",
            )}
          >
            {file.fileName ?? "Unnamed"}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            {PURPOSE_LABEL[file.purpose]}
          </p>
        </div>
        {(canView || canDelete) && (
          <div className="flex flex-wrap gap-2">
            {canView && (
              <button
                type="button"
                onClick={onView}
                className={cn(ghostButton, "min-h-10 px-3")}
              >
                View
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className={cn(
                  secondaryButton,
                  "min-h-10 text-[var(--color-semantic-error-text)]",
                )}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={STATUS_TONE[file.status]}>
          {FILE_STATUS_LABEL[file.status]}
        </StatusPill>
        <StatusPill tone={file.inUse ? "info" : "neutral"}>
          {file.inUse ? "In use" : "Unused"}
        </StatusPill>
        {file.published && <StatusPill tone="success">Public</StatusPill>}
      </div>

      <DetailList
        items={[
          { label: "Size", value: formatBytes(file.sizeBytes) },
          { label: "Owner", value: file.ownerEmail },
          { label: "Created", value: formatDateTime(file.createdAt) },
        ]}
      />
    </article>
  );
}
