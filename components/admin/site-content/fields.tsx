"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing, secondaryButton } from "@/components/profile/styles";
import { FieldError } from "@/components/profile/profile-fields";
import { Field, inputClass, textareaClass } from "@/components/admin/admin-ui";
import { ToggleSwitch } from "@/components/admin/matching-ui";
import { useSiteMedia } from "@/components/admin/site-content/media";
import { FilePicker } from "@/components/files/file-picker";
import { IMAGE_OPTIONS, VIDEO_OPTIONS } from "@/lib/admin-site-content";
import { canOptimizeImage } from "@/lib/media";
import { FILE_RULES, type FileAsset, type FilePurpose } from "@/lib/files";
import { fileRefId, wordCount } from "@/lib/site-content-schema";
import {
  MEDIA_GUIDES,
  mediaFitWarning,
  type MediaSlot,
} from "@/lib/site-media-guides";

// The field kit for the site content editors. Every control has a visible label, an id, and
// aria-describedby / aria-invalid wired by Field. Errors come from validateBlock, keyed by the
// dot path of the value ("items.2.quote"); pass the whole record and a path to each control.

/** The error at a dot path, if validation reported one. */
export function errorAt(
  errors: Record<string, string>,
  path: string,
): string | undefined {
  return errors[path];
}

/** True when any error sits at `path` or below it. */
function hasErrorsUnder(errors: Record<string, string>, path: string): boolean {
  return Object.keys(errors).some(
    (key) => key === path || key.startsWith(`${path}.`),
  );
}

type Count = { text: string; over: boolean };

/** The hint line under a control: the hint text, then the counts. A count over its limit turns red. */
function Counts({ hint, counts }: { hint?: string; counts: Count[] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {hint && <span>{hint}</span>}
      {counts.map((count) => (
        <span
          key={count.text}
          className={cn(
            "tabular-nums",
            count.over && "text-[var(--color-semantic-error-text)]",
          )}
        >
          {count.text}
        </span>
      ))}
    </span>
  );
}

/* ───────── Text ───────── */

export function TextInput({
  label,
  value,
  onChange,
  error,
  max,
  hint,
  type = "text",
  inputMode,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  max: number;
  hint?: string;
  type?: "text" | "email";
  inputMode?: "text" | "tel" | "email";
  disabled?: boolean;
}) {
  const counts = [{ text: `${value.length}/${max}`, over: value.length > max }];
  return (
    <Field
      label={label}
      error={error}
      hint={<Counts hint={hint} counts={counts} />}
    >
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={inputClass}
        />
      )}
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  error,
  max,
  maxWords,
  rows = 4,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  max: number;
  /** Adds a word count. Used where the limit is in words as well as characters. */
  maxWords?: number;
  rows?: number;
  hint?: string;
}) {
  const counts: Count[] = [
    {
      text: `${value.length}/${max} characters`,
      over: value.length > max,
    },
  ];
  if (maxWords !== undefined) {
    const words = wordCount(value);
    counts.push({
      text: `${words}/${maxWords} words`,
      over: words > maxWords,
    });
  }
  return (
    <Field
      label={label}
      error={error}
      hint={<Counts hint={hint} counts={counts} />}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={textareaClass}
        />
      )}
    </Field>
  );
}

/* ───────── Links ───────── */

export interface LinkValue {
  label: string;
  href: string;
}

/** A button or link: its text and where it goes. Errors live at `${path}.label` and `${path}.href`. */
export function LinkInputs({
  label,
  textLabel = "Button text",
  value,
  onChange,
  errors,
  path,
}: {
  /** Shown as the group's legend, e.g. "Register button". */
  label: string;
  /** Label of the text input, e.g. "Link text" for menu links. */
  textLabel?: string;
  value: LinkValue;
  onChange: (value: LinkValue) => void;
  errors: Record<string, string>;
  path: string;
}) {
  return (
    <fieldset className="grid min-w-0 gap-4">
      <legend className="mb-1.5 text-sm font-semibold text-[var(--color-neutral-charcoal)]">
        {label}
      </legend>
      <TextInput
        label={textLabel}
        value={value.label}
        max={40}
        error={errorAt(errors, `${path}.label`)}
        onChange={(next) => onChange({ ...value, label: next })}
      />
      <TextInput
        label="Link"
        value={value.href}
        max={300}
        hint="A site path like /blog, or a link starting with https://"
        error={errorAt(errors, `${path}.href`)}
        onChange={(next) => onChange({ ...value, href: next })}
      />
    </fieldset>
  );
}

/* ───────── Radios ───────── */

/** Native radios in 44px pills, inside a fieldset with a legend. */
export function RadioGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="grid min-w-0 gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-[var(--color-neutral-charcoal)]">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold text-[var(--color-neutral-charcoal)] transition-[background-color,border-color] duration-150 ease-out motion-reduce:transition-none",
                checked
                  ? "border-[var(--color-primary-core)] bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]"
                  : "border-[var(--color-border-control)] bg-[var(--color-neutral-white)] hover:bg-[var(--color-neutral-off-white)]",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className={cn(
                  "size-4 accent-[var(--color-primary-core)]",
                  focusRing,
                )}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ───────── Media ───────── */

type MediaChoice = "upload" | "builtIn" | "link";

const CHOICE_LABEL: Record<MediaChoice, string> = {
  upload: "Upload a file",
  builtIn: "Use a built-in file",
  link: "Other link",
};

/** Where a stored media value comes from. An empty value starts on upload. */
function choiceFor(value: string): MediaChoice {
  if (value === "" || fileRefId(value)) return "upload";
  if (value.startsWith("/")) return "builtIn";
  return "link";
}

/** The box the preview sits in, shaped like the slot it previews on the landing page. */
const PREVIEW_SHAPE: Record<MediaSlot, string> = {
  testimonialPhoto: "aspect-square",
  testimonialVideo: "aspect-square",
  showcasePoster: "aspect-[3/4]",
  showcaseVideo: "aspect-[3/4]",
  howItWorksPoster: "aspect-video",
  howItWorksVideo: "aspect-video",
};

/** The host of an https link, or the text itself while it is still being typed. */
function linkHost(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}

/**
 * A photo or video for one landing slot. The admin uploads a file, picks a built-in one, or (for
 * video, or a link already saved) pastes an https link. An upload is saved as `file:<id>`; the
 * preview and the source line show what the field holds. Guidance comes from MEDIA_GUIDES.
 * Warnings about size or shape never block a save.
 */
export function MediaField({
  slot,
  label,
  value,
  onChange,
  error,
}: {
  slot: MediaSlot;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const guide = MEDIA_GUIDES[slot];
  const kind = guide.kind;
  const purpose: FilePurpose = kind === "image" ? "SITE_IMAGE" : "SITE_VIDEO";
  const builtIns = kind === "image" ? IMAGE_OPTIONS : VIDEO_OPTIONS;
  const uid = useId();
  const guideId = `${uid}-guide`;
  const errorId = `${uid}-error`;
  const { media, owners, register, createObjectUrl, setBusy } = useSiteMedia();

  const category = choiceFor(value);
  const [choice, setChoice] = useState(category);
  // When the value's kind changes from outside (a discard, a reset), the radios follow it.
  const [seen, setSeen] = useState(category);
  if (seen !== category) {
    setSeen(category);
    setChoice(category);
  }

  // The size warning for the last picked file, and the URL of that file until it is saved.
  const [fit, setFit] = useState<string | null>(null);
  const picked = useRef<string | null>(null);
  const probeRun = useRef(0);

  const reportBusy = useCallback(
    (busy: boolean) => setBusy(uid, busy),
    [setBusy, uid],
  );
  useEffect(() => () => setBusy(uid, false), [setBusy, uid]);

  const fileId = fileRefId(value);
  const entry = fileId ? media[fileId] : undefined;
  const previewUrl = fileId
    ? (entry?.url ?? null)
    : category === "builtIn" ||
        (category === "link" && value.startsWith("https://"))
      ? value
      : null;
  const source = fileId
    ? owners[fileId]
      ? `Uploaded by ${owners[fileId]}`
      : `Uploaded: ${entry?.originalName ?? "file"}`
    : category === "builtIn"
      ? `Built-in: ${value.split("/").pop()}`
      : category === "link" && value !== ""
        ? `Link: ${linkHost(value)}`
        : null;

  const linkAllowed = kind === "video" || category === "link";
  const choices = (
    linkAllowed ? ["upload", "builtIn", "link"] : ["upload", "builtIn"]
  ) as MediaChoice[];

  function chooseSource(next: MediaChoice) {
    // Switching away unmounts the picker, which cancels an upload in progress.
    if (next !== "upload") setBusy(uid, false);
    setChoice(next);
  }

  function onPick(file: File) {
    picked.current = createObjectUrl(file);
    setFit(null);
    const run = ++probeRun.current;
    const url = picked.current;
    if (kind === "image") {
      const probe = new window.Image();
      probe.onload = () => {
        if (run === probeRun.current) {
          setFit(
            mediaFitWarning(slot, probe.naturalWidth, probe.naturalHeight),
          );
        }
      };
      probe.src = url;
    } else {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        if (run === probeRun.current) {
          setFit(mediaFitWarning(slot, probe.videoWidth, probe.videoHeight));
        }
      };
      probe.src = url;
    }
  }

  function onUploaded(asset: FileAsset | null) {
    const url = picked.current;
    picked.current = null;
    if (!asset) return;
    if (url) {
      register(asset.id, {
        url,
        contentType: asset.contentType,
        originalName: asset.fileName,
      });
    }
    onChange(`file:${asset.id}`);
  }

  const describedBy =
    [guideId, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const selectValue = category === "builtIn" ? value : "";
  const listed = builtIns.some((option) => option.value === value);
  const selectOptions =
    category === "builtIn" && !listed
      ? [{ value, label: `Current: ${value}` }, ...builtIns]
      : builtIns;

  return (
    <fieldset className="grid min-w-0 gap-4">
      <legend className="mb-1.5 text-sm font-semibold text-[var(--color-neutral-charcoal)]">
        {label}
      </legend>

      {(previewUrl || source) && (
        <div className="grid min-w-0 justify-items-start gap-2">
          {previewUrl && (
            <div
              className={cn(
                "relative w-60 max-w-full overflow-hidden rounded-[12px] bg-[var(--color-surface-subtle)] outline outline-1 -outline-offset-1 outline-[oklch(0_0_0/0.1)]",
                PREVIEW_SHAPE[slot],
              )}
            >
              {kind === "image" ? (
                <Image
                  src={previewUrl}
                  alt=""
                  fill
                  unoptimized={!canOptimizeImage(previewUrl)}
                  sizes="240px"
                  className="object-cover"
                />
              ) : (
                <video
                  src={previewUrl}
                  aria-label={`${label} preview`}
                  controls
                  muted
                  preload="metadata"
                  className="size-full object-cover"
                />
              )}
            </div>
          )}
          {source && (
            <p className="text-xs break-all text-[var(--color-text-secondary)]">
              {source}
            </p>
          )}
        </div>
      )}

      <div
        id={guideId}
        className="grid gap-0.5 text-xs text-[var(--color-text-secondary)]"
      >
        <p>{guide.shape}</p>
        <p>{guide.crop}</p>
        <p>{FILE_RULES[purpose].hint}.</p>
      </div>

      <RadioGroup
        legend="Source"
        options={choices.map((value) => ({
          value,
          label: CHOICE_LABEL[value],
        }))}
        value={choice}
        onChange={chooseSource}
      />

      {choice === "upload" && (
        <div className="grid min-w-0 gap-2">
          <FilePicker
            purpose={purpose}
            value={null}
            onChange={onUploaded}
            onPick={onPick}
            onBusyChange={reportBusy}
            chooseLabel={
              kind === "image" ? "Choose an image" : "Choose a video"
            }
            describedBy={describedBy}
            invalid={Boolean(error)}
          />
          {fit && (
            <p
              role="status"
              className="text-sm font-medium text-[var(--color-semantic-warning-text)]"
            >
              {fit}
            </p>
          )}
          <FieldError id={errorId} message={error} />
        </div>
      )}

      {choice === "builtIn" && (
        <Field
          label={kind === "image" ? "Built-in image" : "Built-in video"}
          error={error}
        >
          {({ id, describedBy: fieldDescribedBy, invalid }) => (
            <select
              id={id}
              value={selectValue}
              onChange={(e) => onChange(e.target.value)}
              aria-describedby={fieldDescribedBy}
              aria-invalid={invalid || undefined}
              className={inputClass}
            >
              {selectValue === "" && (
                <option value="" disabled>
                  {kind === "image" ? "Pick an image" : "Pick a video"}
                </option>
              )}
              {selectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {choice === "link" && (
        <TextInput
          label={kind === "image" ? "Image link" : "Video link"}
          value={category === "link" ? value : ""}
          max={300}
          hint={
            kind === "image"
              ? "A link starting with https://"
              : "Use /videos/<file>.mp4 or a link starting with https://"
          }
          error={error}
          onChange={onChange}
        />
      )}
    </fieldset>
  );
}

/* ───────── Toggle ───────── */

/** The show/hide switch every section block has. */
export function SectionToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <ToggleSwitch
      label="Show this section on the landing page"
      description="Turn it off to hide the section and its links in the menu."
      on={value}
      onChange={onChange}
    />
  );
}

/* ───────── Lists ───────── */

const ICON_BUTTON = cn(
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--color-primary-core)] transition-[background-color,scale] duration-150 ease-out hover:bg-[var(--color-secondary-sky)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100",
  focusRing,
);

/**
 * A repeatable list of cards. Each card is collapsed by default and opens on its own; a card
 * with errors opens and is outlined in the error colour. Cards move and remove through the
 * buttons on their header; the list clamps to `min` and `max`.
 *
 * `onChange` gets the whole new array. `onMove` and `onRemove` run just before it, with the
 * indexes involved, so a caller can fix dependent state (the FAQ's open question) in that same
 * onChange. They never write state on their own.
 */
export function ListEditor<T>({
  label,
  items,
  onChange,
  min,
  max,
  singular,
  newItem,
  itemLabel,
  renderItem,
  errors,
  path,
  onMove,
  onRemove,
  extras,
}: {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  min: number;
  max: number;
  /** The noun for the add button: "Add question". */
  singular: string;
  newItem: () => T;
  itemLabel: (item: T, index: number) => string;
  renderItem: (item: T, index: number, update: (next: T) => void) => ReactNode;
  errors: Record<string, string>;
  path: string;
  onMove?: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
  /** Controls beside Add. `append` adds an item at the end with its card open. */
  extras?: (append: (item: T) => void) => ReactNode;
}) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  // Open state lives here, by position, so moves and removals can carry it along.
  const [openFlags, setOpenFlags] = useState<boolean[]>([]);
  // Focus goes somewhere sensible after a move, remove or add (a new object each time).
  // index -1 means the add button.
  const [focusTarget, setFocusTarget] = useState<{
    index: number;
    action: "up" | "down" | "remove" | "toggle";
  } | null>(null);

  useEffect(() => {
    if (!focusTarget) return;
    const root = rootRef.current;
    const selector =
      focusTarget.index < 0
        ? "[data-list-add]"
        : `[data-list-card="${focusTarget.index}"] [data-list-action="${focusTarget.action}"]`;
    root?.querySelector<HTMLElement>(selector)?.focus();
  }, [focusTarget]);

  const flags = items.map((_, i) => openFlags[i] ?? false);
  const atMin = items.length <= min;
  const atMax = items.length >= max;
  const listError = errorAt(errors, path);

  function setOpen(index: number, open: boolean) {
    setOpenFlags(flags.map((flag, i) => (i === index ? open : flag)));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    const nextFlags = [...flags];
    [nextFlags[from], nextFlags[to]] = [nextFlags[to], nextFlags[from]];
    setOpenFlags(nextFlags);
    onMove?.(from, to);
    onChange(next);
    // Keep focus on the moved card; use the other arrow when this one is at an edge.
    const up = to < from;
    const action = up
      ? to > 0
        ? "up"
        : "down"
      : to < items.length - 1
        ? "down"
        : "up";
    setFocusTarget({ index: to, action });
  }

  function remove(index: number) {
    if (atMin) return;
    setOpenFlags(flags.filter((_, i) => i !== index));
    onRemove?.(index);
    const next = items.filter((_, i) => i !== index);
    onChange(next);
    setFocusTarget(
      next.length > min
        ? { index: Math.min(index, next.length - 1), action: "remove" }
        : { index: -1, action: "remove" },
    );
  }

  function append(item: T) {
    if (atMax) return;
    setOpenFlags([...flags, true]);
    onChange([...items, item]);
  }

  function add() {
    if (atMax) return;
    append(newItem());
    setFocusTarget({ index: items.length, action: "toggle" });
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-labelledby={`${uid}-label`}
      aria-describedby={listError ? `${uid}-error` : undefined}
      className="grid min-w-0 gap-3"
    >
      <p
        id={`${uid}-label`}
        className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
      >
        {label}
      </p>
      <FieldError id={`${uid}-error`} message={listError} />

      {items.length > 0 && (
        <ol className="grid gap-2">
          {items.map((item, i) => {
            const name = itemLabel(item, i);
            const cardError = hasErrorsUnder(errors, `${path}.${i}`);
            const expanded = flags[i] || cardError;
            const panelId = `${uid}-panel-${i}`;
            return (
              <li
                key={i}
                data-list-card={i}
                className={cn(
                  "min-w-0 rounded-[16px] border bg-[var(--color-neutral-white)]",
                  cardError
                    ? "border-[var(--color-semantic-error-text)]"
                    : "border-[var(--color-border-control)]",
                )}
              >
                <div className="flex items-center gap-1 px-1">
                  <button
                    type="button"
                    data-list-action="toggle"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpen(i, !expanded)}
                    className={cn(
                      "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[12px] px-3 py-2 text-start text-sm font-semibold text-[var(--color-neutral-charcoal)] hover:bg-[var(--color-neutral-off-white)]",
                      focusRing,
                    )}
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {i + 1}. {name}
                    </span>
                    {cardError && (
                      <span className="shrink-0 text-xs font-semibold text-[var(--color-semantic-error-text)]">
                        Needs fixing
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    data-list-action="up"
                    aria-label={`Move up: ${name}`}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                    className={ICON_BUTTON}
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    data-list-action="down"
                    aria-label={`Move down: ${name}`}
                    disabled={i === items.length - 1}
                    onClick={() => move(i, i + 1)}
                    className={ICON_BUTTON}
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    data-list-action="remove"
                    aria-label={`Remove: ${name}`}
                    disabled={atMin}
                    title={atMin ? `Keep at least ${min}` : undefined}
                    onClick={() => remove(i)}
                    className={cn(
                      ICON_BUTTON,
                      "text-[var(--color-semantic-error-text)]",
                    )}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
                <div
                  id={panelId}
                  className={cn("grid gap-4 p-4 pt-2", !expanded && "hidden")}
                >
                  {renderItem(item, i, (next) => {
                    onChange(items.map((row, j) => (j === i ? next : row)));
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          data-list-add
          onClick={add}
          disabled={atMax}
          className={secondaryButton}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add {singular}
        </button>
        {extras?.(append)}
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          Up to {max}
        </p>
      </div>
    </div>
  );
}
