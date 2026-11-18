"use client";

import { useCallback, useRef, useState } from "react";
import { client, unwrap, type Schemas } from "./api-client";
import { errorCodeMessage } from "./api-errors";
import { ApiError } from "./profile";

// Upload flow (tuition-api /files): ask for a signed URL, PUT the bytes straight to R2,
// then confirm. The returned FileAsset id is what feature endpoints take as `fileId`.

export type FileAsset = Schemas["FileAsset"];
export type FilePurpose = FileAsset["purpose"];

const MB = 1024 * 1024;

/** Mirrors tuition-api src/modules/files/file-policy.ts so the browser can refuse early. */
export const FILE_RULES: Record<
  FilePurpose,
  { accept: string[]; maxBytes: number; hint: string }
> = {
  STUDENT_ID: {
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxBytes: 10 * MB,
    hint: "JPG, PNG, WebP or PDF, up to 10 MB",
  },
  TUTOR_ID: {
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxBytes: 10 * MB,
    hint: "JPG, PNG, WebP or PDF, up to 10 MB",
  },
  CREDENTIAL: {
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxBytes: 10 * MB,
    hint: "JPG, PNG, WebP or PDF, up to 10 MB",
  },
  TUTOR_VIDEO: {
    accept: ["video/mp4", "video/webm", "video/quicktime"],
    maxBytes: 150 * MB,
    hint: "MP4, WebM or MOV, up to 150 MB",
  },
  BLOG_COVER: {
    accept: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 5 * MB,
    hint: "JPG, PNG or WebP, up to 5 MB",
  },
};

/** The `accept` attribute for a file input. */
export function acceptFor(purpose: FilePurpose): string {
  return FILE_RULES[purpose].accept.join(",");
}

/** A message when the browser can already tell the file will be refused, else null. */
export function checkFile(purpose: FilePurpose, file: File): string | null {
  const rule = FILE_RULES[purpose];
  if (!rule.accept.includes(file.type)) return `Use ${rule.hint}.`;
  if (file.size === 0) return "That file is empty.";
  if (file.size > rule.maxBytes) {
    return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(rule.maxBytes)}.`;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / MB;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export const fileApi = {
  uploadUrl: (body: Schemas["CreateUploadUrlInput"]) =>
    unwrap(client.POST("/api/v1/files/upload-url", { body })),
  complete: (id: string) =>
    unwrap(
      client.POST("/api/v1/files/{id}/complete", { params: { path: { id } } }),
    ),
  downloadUrl: (id: string) =>
    unwrap(
      client.GET("/api/v1/files/{id}/download-url", {
        params: { path: { id } },
      }),
    ),
  remove: (id: string) =>
    unwrap(client.DELETE("/api/v1/files/{id}", { params: { path: { id } } })),
};

function putToStorage(
  url: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError("The upload failed. Try again.", xhr.status));
    xhr.onerror = () =>
      reject(new ApiError("The upload failed. Check your connection.", 0));
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/** Uploads one file and resolves to the finished FileAsset. */
export async function uploadFile(
  purpose: FilePurpose,
  file: File,
  options: {
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<FileAsset> {
  const signal = options.signal ?? new AbortController().signal;
  const ticket = await fileApi.uploadUrl({
    purpose,
    contentType: file.type,
    sizeBytes: file.size,
    fileName: file.name.slice(0, 200) || undefined,
  });
  await putToStorage(
    ticket.uploadUrl,
    file,
    ticket.headers["Content-Type"],
    options.onProgress ?? (() => {}),
    signal,
  );
  options.onProgress?.(1);
  return fileApi.complete(ticket.file.id);
}

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string; progress: number }
  | { status: "done"; file: FileAsset }
  | { status: "error"; message: string };

/**
 * Upload state for one picker. `start` checks the file in the browser first, then uploads;
 * it resolves to the FileAsset, or null when the file was refused, cancelled or failed
 * (the reason is in `state`).
 */
export function useFileUpload(purpose: FilePurpose) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  const start = useCallback(
    async (file: File): Promise<FileAsset | null> => {
      const problem = checkFile(purpose, file);
      if (problem) {
        setState({ status: "error", message: problem });
        return null;
      }
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setState({ status: "uploading", fileName: file.name, progress: 0 });
      try {
        const asset = await uploadFile(purpose, file, {
          signal: abort.signal,
          onProgress: (progress) =>
            setState({ status: "uploading", fileName: file.name, progress }),
        });
        setState({ status: "done", file: asset });
        return asset;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setState({ status: "idle" });
          return null;
        }
        const message =
          errorCodeMessage(err) ??
          (err instanceof ApiError && err.message
            ? err.message
            : "The upload failed. Try again.");
        setState({ status: "error", message });
        return null;
      }
    },
    [purpose],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => {
    controller.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, start, cancel, reset };
}

/** Opens a private file (ID, credential) in a new tab through a short-lived signed URL. */
export async function openFile(fileId: string): Promise<void> {
  // Open the tab synchronously so popup blockers allow it, then point it at the signed URL.
  const tab = window.open("about:blank", "_blank");
  try {
    const { url } = await fileApi.downloadUrl(fileId);
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (err) {
    tab?.close();
    throw err;
  }
}
