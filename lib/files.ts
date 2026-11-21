"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
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
    maxBytes: 2 * MB,
    hint: "JPG, PNG, WebP or PDF, up to 2 MB",
  },
  TUTOR_ID: {
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxBytes: 2 * MB,
    hint: "JPG, PNG, WebP or PDF, up to 2 MB",
  },
  CREDENTIAL: {
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxBytes: 2 * MB,
    hint: "JPG, PNG, WebP or PDF, up to 2 MB",
  },
  TUTOR_VIDEO: {
    accept: ["video/mp4", "video/webm", "video/quicktime"],
    maxBytes: 2 * MB,
    hint: "MP4, WebM or MOV, up to 2 MB",
  },
  BLOG_COVER: {
    accept: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 2 * MB,
    hint: "JPG, PNG or WebP, up to 2 MB",
  },
  SITE_IMAGE: {
    accept: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 5 * MB,
    hint: "JPG, PNG or WebP, up to 5 MB",
  },
  SITE_VIDEO: {
    accept: ["video/mp4", "video/webm"],
    maxBytes: 25 * MB,
    hint: "MP4 or WebM, up to 25 MB",
  },
  STORY_IMAGE: {
    accept: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 5 * MB,
    hint: "JPG, PNG or WebP, up to 5 MB",
  },
  STORY_VIDEO: {
    accept: ["video/mp4", "video/webm"],
    maxBytes: 25 * MB,
    hint: "MP4 or WebM, up to 25 MB",
  },
};

/** The `accept` attribute for a file input. Extensions too, for pickers that ignore types. */
export function acceptFor(purpose: FilePurpose): string {
  const types = FILE_RULES[purpose].accept;
  const extensions = Object.entries(EXTENSION_TYPES)
    .filter(([, type]) => types.includes(type))
    .map(([ext]) => `.${ext}`);
  return [...types, ...extensions].join(",");
}

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

// Non-standard names some browsers and OSes report for accepted types.
const TYPE_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "video/x-m4v": "video/mp4",
};

/**
 * The content type to declare for a file. Browsers sometimes report no type, a generic one or a
 * non-standard alias (some Windows and Android pickers); fall back to the extension then. The
 * server still checks the file's first bytes, so a wrong extension cannot get a file through.
 */
export function fileContentType(file: Pick<File, "name" | "type">): string {
  const reported = file.type.trim().toLowerCase();
  const type = TYPE_ALIASES[reported] ?? reported;
  if (type && type !== "application/octet-stream") return type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? type;
}

/** A message when the browser can already tell the file will be refused, else null. */
export function checkFile(
  purpose: FilePurpose,
  file: Pick<File, "name" | "type" | "size">,
): string | null {
  const rule = FILE_RULES[purpose];
  if (!rule.accept.includes(fileContentType(file))) return `Use ${rule.hint}.`;
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

/** Give up on a PUT that has not finished by then. The signed link lasts 10 minutes. */
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

function isRetryable(err: unknown): boolean {
  // fetch throws TypeError when the network drops; 5xx means the server may succeed next time.
  return (
    err instanceof TypeError ||
    (err instanceof ApiError && (err.status === 0 || err.status >= 500))
  );
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

/**
 * Confirms the upload, retrying a dropped connection or server error twice (after 1 s, then
 * 3 s). Complete is idempotent on the server, so a retry after a lost response is safe.
 */
async function completeWithRetry(
  id: string,
  signal: AbortSignal,
): Promise<FileAsset> {
  for (const delay of [1000, 3000]) {
    try {
      return await fileApi.complete(id);
    } catch (err) {
      if (!isRetryable(err)) throw err;
      await wait(delay, signal);
    }
  }
  return fileApi.complete(id);
}

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
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new ApiError(
              // R2 answers 403 when the signed link expired or the file changed size after picking.
              xhr.status === 403
                ? "The upload link expired or the file changed. Choose the file again."
                : "The upload failed. Try again.",
              xhr.status,
            ),
          );
    xhr.onerror = () =>
      reject(new ApiError("The upload failed. Check your connection.", 0));
    xhr.ontimeout = () =>
      reject(
        new ApiError(
          "The upload stopped responding. Check your connection and try again.",
          0,
        ),
      );
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
  // The server cleans and shortens the name; only cap what is sent.
  const ticket = await fileApi.uploadUrl({
    purpose,
    contentType: fileContentType(file),
    sizeBytes: file.size,
    fileName: file.name.slice(0, 1000) || undefined,
  });
  await putToStorage(
    ticket.uploadUrl,
    file,
    ticket.headers["Content-Type"],
    options.onProgress ?? (() => {}),
    signal,
  );
  options.onProgress?.(1);
  return completeWithRetry(ticket.file.id, signal);
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

  // Closing the dialog mid-upload stops the transfer; the unfinished file row is swept later.
  useEffect(() => () => controller.current?.abort(), []);

  // Leaving or reloading the page mid-upload would lose it: ask the browser to confirm first.
  const uploading = state.status === "uploading";
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

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
  /** Shows a message without uploading, e.g. when several files were dropped at once. */
  const refuse = useCallback(
    (message: string) => setState({ status: "error", message }),
    [],
  );
  const reset = useCallback(() => {
    controller.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, start, cancel, reset, refuse };
}

export type PreviewKind = "image" | "pdf" | "video" | "none";

/** How the admin preview renders a file of this content type. */
export function previewKind(contentType: string): PreviewKind {
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/pdf") return "pdf";
  if (contentType.startsWith("video/")) return "video";
  return "none";
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

/**
 * True when a signed R2 URL has expired, or will within `marginMs`. Unsigned (public) URLs never
 * expire. Reads X-Amz-Date and X-Amz-Expires from the query string.
 */
export function signedUrlExpired(
  url: string,
  now = Date.now(),
  marginMs = 30_000,
): boolean {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return false;
  }
  const date = params.get("X-Amz-Date");
  const expires = Number(params.get("X-Amz-Expires"));
  const parts = date?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!parts || !Number.isFinite(expires)) return false;
  const [, y, mo, d, h, mi, se] = parts.map(Number);
  const signedAt = Date.UTC(y, mo - 1, d, h, mi, se);
  return signedAt + expires * 1000 - marginMs <= now;
}

/**
 * `onError` for an <img> or <video> showing a signed URL. Signed links last an hour, so a page
 * left open shows broken media; when the link has expired this refetches the active queries,
 * which hand out fresh links. A file that fails for another reason is left alone (no loop).
 */
export function useRefreshExpiredMedia() {
  const queryClient = useQueryClient();
  return useCallback(
    (event: SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
      const el = event.currentTarget;
      if (!signedUrlExpired(el.currentSrc || el.src)) return;
      void queryClient.invalidateQueries({ type: "active" });
    },
    [queryClient],
  );
}
