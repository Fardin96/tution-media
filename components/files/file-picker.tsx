"use client";

import * as React from "react";
import { FileCheck2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  acceptFor,
  FILE_RULES,
  formatBytes,
  useFileUpload,
  type FileAsset,
  type FilePurpose,
} from "@/lib/files";
import {
  focusRing,
  ghostButton,
  secondaryButton,
} from "@/components/profile/styles";

type FilePickerProps = {
  purpose: FilePurpose;
  /** The uploaded file, or null before one is chosen. */
  value: FileAsset | null;
  onChange: (file: FileAsset | null) => void;
  /** Text on the choose button, e.g. "Choose your ID". */
  chooseLabel?: string;
  /** Wire to a Field: the id goes on the choose button, describedBy on the drop zone. */
  id?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Called while an upload is running, so the form can hold its submit button. */
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Picks one file and uploads it straight away, with progress and cancel. The form submits
 * only the resulting FileAsset id. Drop a file on the zone or use the button.
 */
export function FilePicker({
  purpose,
  value,
  onChange,
  chooseLabel = "Choose a file",
  id,
  describedBy,
  invalid,
  disabled,
  onBusyChange,
}: FilePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { state, start, cancel, reset, refuse } = useFileUpload(purpose);
  const [dragging, setDragging] = React.useState(false);
  const errorId = React.useId();
  const busy = state.status === "uploading";

  React.useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const asset = await start(file);
    if (asset) onChange(asset);
  };

  const describe =
    [describedBy, state.status === "error" ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  if (value && state.status !== "uploading") {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl bg-[var(--color-surface-subtle)] px-4 py-3">
        <FileCheck2
          aria-hidden="true"
          className="size-5 shrink-0 text-[var(--color-primary-core)]"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold break-all text-[var(--color-neutral-charcoal)]">
            {value.fileName ?? "Uploaded file"}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
            {formatBytes(value.sizeBytes)} · Uploaded
          </p>
        </div>
        <button
          type="button"
          className={cn(ghostButton, "min-h-10")}
          disabled={disabled}
          onClick={() => {
            reset();
            onChange(null);
          }}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      aria-describedby={describe}
      onDragOver={(event) => {
        if (disabled || busy) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled || busy) return;
        const { files } = event.dataTransfer;
        if (files.length > 1) {
          refuse("Drop one file at a time.");
          return;
        }
        void pick(files[0]);
      }}
      className={cn(
        "grid min-w-0 gap-3 rounded-2xl px-4 py-4 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] transition-[background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
        dragging &&
          "bg-[var(--color-secondary-sky)] shadow-[inset_0_0_0_2px_var(--color-primary-core)]",
        invalid && "shadow-[inset_0_0_0_1px_var(--color-semantic-error-text)]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptFor(purpose)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {busy ? (
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <p className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold break-all text-[var(--color-neutral-charcoal)]">
              {state.fileName}
            </p>
            <span className="shrink-0 text-xs text-[var(--color-text-secondary)] tabular-nums">
              {Math.round(state.progress * 100)}%
            </span>
            <button
              type="button"
              onClick={cancel}
              aria-label="Cancel upload"
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-off-white)]",
                focusRing,
              )}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div
            role="progressbar"
            aria-label={`Uploading ${state.fileName}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(state.progress * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-subtle)]"
          >
            <div
              className="h-full origin-left rounded-full bg-[var(--color-primary-core)] transition-[scale] duration-200 ease-linear motion-reduce:transition-none"
              style={{ scale: `${state.progress} 1` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            id={id}
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={cn(secondaryButton, "min-h-10")}
          >
            <Upload aria-hidden="true" className="size-4" />
            {chooseLabel}
          </button>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {FILE_RULES[purpose].hint}. You can also drop it here.
          </p>
        </div>
      )}

      {state.status === "error" && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-[var(--color-semantic-error-text)]"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
