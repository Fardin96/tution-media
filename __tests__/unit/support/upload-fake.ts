import { useState } from "react";
import type { FileAsset, FilePurpose, UploadState } from "@/lib/files";

// A stand-in for useFileUpload. The real hook uploads through the API and R2, which the unit
// tests do not reach. Each start() waits in `started` until a test finishes it with an asset
// (or null, for a cancel). The browser-side file check still runs, as it does for real.

type CheckFile = (
  purpose: FilePurpose,
  file: Pick<File, "name" | "type" | "size">,
) => string | null;

export const started: {
  file: File;
  finish: (asset: FileAsset | null) => void;
}[] = [];

/** Builds the fake hook. Pass the real checkFile so refused files still show the real message. */
export function fakeFileUploadModule(checkFile: CheckFile) {
  return {
    useFileUpload(purpose: FilePurpose) {
      const [state, setState] = useState<UploadState>({ status: "idle" });

      function start(file: File): Promise<FileAsset | null> {
        const problem = checkFile(purpose, file);
        if (problem) {
          setState({ status: "error", message: problem });
          return Promise.resolve(null);
        }
        setState({ status: "uploading", fileName: file.name, progress: 0 });
        return new Promise((resolve) => {
          started.push({
            file,
            finish: (asset) => {
              setState(
                asset ? { status: "done", file: asset } : { status: "idle" },
              );
              resolve(asset);
            },
          });
        });
      }

      return {
        state,
        start,
        cancel: () => setState({ status: "idle" }),
        reset: () => setState({ status: "idle" }),
        refuse: (message: string) => setState({ status: "error", message }),
      };
    },
  };
}

/** A finished upload as the API returns it. */
export function uploadedAsset(overrides: Partial<FileAsset> = {}): FileAsset {
  return {
    id: "9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f",
    purpose: "SITE_IMAGE",
    contentType: "image/png",
    sizeBytes: 1024,
    status: "UPLOADED",
    fileName: "photo.png",
    createdAt: "2026-11-21T09:00:00.000Z",
    uploadedAt: "2026-11-21T09:00:05.000Z",
    ...overrides,
  };
}
