"use client";

import { useQuery } from "@tanstack/react-query";
import { fileApi, previewKind, useRefreshExpiredMedia } from "@/lib/files";
import { errorCodeMessage } from "@/lib/api-errors";
import { cn } from "@/lib/utils";

// Inline preview of a private file for admins. The signed URL is fetched when this mounts, so
// render it only after the admin asks to see the file (each admin view of an ID is audited).

const frame =
  "w-full rounded-[16px] bg-[var(--color-neutral-off-white)] outline outline-1 -outline-offset-1 outline-black/10";

export function FilePreview({
  fileId,
  contentType,
  name,
}: {
  fileId: string;
  contentType: string;
  name: string | null;
}) {
  const query = useQuery({
    queryKey: ["file-preview", fileId],
    queryFn: () => fileApi.downloadUrl(fileId),
    // Signed URLs last 5 minutes; refetch before that so a reopened preview never 403s.
    staleTime: 4 * 60 * 1000,
    gcTime: 4 * 60 * 1000,
    retry: false,
  });
  const refreshExpired = useRefreshExpiredMedia();

  if (query.isPending) {
    return (
      <div
        role="status"
        className={cn(
          frame,
          "flex h-48 items-center justify-center text-sm text-[var(--color-text-secondary)]",
        )}
      >
        Loading preview
      </div>
    );
  }

  if (query.isError) {
    return (
      <div
        role="alert"
        className={cn(
          frame,
          "flex min-h-24 items-center justify-center p-4 text-center text-sm text-[var(--color-semantic-error-text)]",
        )}
      >
        {errorCodeMessage(query.error) ?? "Couldn't load the preview."}
      </div>
    );
  }

  const { url } = query.data;
  const label = name ?? "Uploaded file";
  const kind = previewKind(contentType);

  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        onError={refreshExpired}
        alt={label}
        loading="lazy"
        className={cn(frame, "max-h-[32rem] object-contain")}
      />
    );
  }
  if (kind === "pdf") {
    return (
      <iframe
        src={url}
        title={label}
        className={cn(frame, "h-[32rem] bg-white")}
      />
    );
  }
  if (kind === "video") {
    return (
      <video
        controls
        preload="metadata"
        src={url}
        onError={refreshExpired}
        className={cn(frame, "aspect-video bg-black")}
      />
    );
  }
  return (
    <div
      className={cn(
        frame,
        "flex min-h-24 items-center justify-center p-4 text-center text-sm text-[var(--color-text-secondary)]",
      )}
    >
      This file type can&apos;t be previewed. Open it in a new tab instead.
    </div>
  );
}
