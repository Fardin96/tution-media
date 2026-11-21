"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  focusRing,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { cn } from "@/lib/utils";
import {
  AdminPage,
  Field,
  QueryState,
  Section,
  StatusPill,
  inputClass,
} from "@/components/admin/admin-ui";
import { EDITOR_COMPONENTS } from "@/components/admin/site-content/editors";
import { BlockPreview } from "@/components/admin/site-content/preview";
import {
  SiteMediaContext,
  useSiteMediaStore,
} from "@/components/admin/site-content/media";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  BLOCK_META,
  apiFieldErrors,
  resolveMedia,
  sourceOwners,
  updatedText,
  useAdminSiteContent,
  useResetSiteContent,
  useSiteSources,
  useUpdateSiteContent,
  validateBlock,
  type AdminSiteContentItem,
  type BlockGroup,
  type BlockMeta,
} from "@/lib/admin-site-content";
import {
  SITE_CONTENT_DEFAULTS,
  type FooterBlock,
  type CtaBannerBlock,
} from "@/lib/site-content";
import type { SiteContentKey } from "@/lib/site-content-schema";
import { errorCodeMessage } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";
import { toastError } from "@/lib/toast";

const GROUPS: BlockGroup[] = ["Landing page", "Pages"];
const DEFAULT_BLOCK: SiteContentKey = "hero";

/** The admin's site content: a block picker and the editor for the chosen block. */
export function SiteContentPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const list = useAdminSiteContent();

  const rawBlock = searchParams.get("block") ?? DEFAULT_BLOCK;
  const chosen: SiteContentKey =
    BLOCK_META.find((meta) => meta.key === rawBlock)?.key ?? DEFAULT_BLOCK;

  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<SiteContentKey | null>(null);

  // Leaving the tab with unsaved changes asks the browser to confirm.
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function go(next: SiteContentKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_BLOCK) params.delete("block");
    else params.set("block", next);
    const qs = params.toString();
    setDirty(false);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function chooseBlock(next: SiteContentKey) {
    if (next === chosen) return;
    if (dirty) setPending(next);
    else go(next);
  }

  const items = list.data?.items ?? [];
  const item = items.find((row) => row.key === chosen);
  const meta = BLOCK_META.find((row) => row.key === chosen);
  const pendingLabel = BLOCK_META.find((row) => row.key === pending)?.label;

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Site content"
      description="Edit the landing page and the About, Terms, Privacy and Contact pages. Changes go live when you save."
    >
      <QueryState
        query={list}
        isEmpty={false}
        loadingLabel="Loading site content"
        errorText="Could not load the site content."
        emptyText=""
        skeletonCount={2}
      >
        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <BlockPicker chosen={chosen} items={items} onChange={chooseBlock} />
          {item && meta && (
            <EditorPane
              key={item.key}
              meta={meta}
              item={item}
              items={items}
              onDirtyChange={setDirty}
              onReload={async () =>
                (await list.refetch()).data?.items.find(
                  (row) => row.key === meta.key,
                )
              }
            />
          )}
        </div>
      </QueryState>

      <ConfirmDialog
        open={pending !== null}
        title="Discard unsaved changes?"
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        actions={[
          {
            label: "Keep editing",
            variant: "secondary",
            onSelect: () => setPending(null),
          },
          {
            label: "Discard",
            variant: "primary",
            onSelect: () => {
              if (pending) go(pending);
              setPending(null);
            },
          },
        ]}
      >
        <p>Your changes to {pendingLabel ?? "this block"} are not saved.</p>
      </ConfirmDialog>
    </AdminPage>
  );
}

/* ───────── Block picker ───────── */

function BlockPicker({
  chosen,
  items,
  onChange,
}: {
  chosen: SiteContentKey;
  items: AdminSiteContentItem[];
  onChange: (key: SiteContentKey) => void;
}) {
  const edited = new Set(
    items.filter((row) => !row.isDefault).map((row) => row.key),
  );
  return (
    <>
      <div className="lg:hidden">
        <Field label="Block">
          {({ id, describedBy }) => (
            <select
              id={id}
              aria-describedby={describedBy}
              value={chosen}
              onChange={(e) => onChange(e.target.value as SiteContentKey)}
              className={inputClass}
            >
              {GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {BLOCK_META.filter((meta) => meta.group === group).map(
                    (meta) => (
                      <option key={meta.key} value={meta.key}>
                        {edited.has(meta.key)
                          ? `${meta.label} (edited)`
                          : meta.label}
                      </option>
                    ),
                  )}
                </optgroup>
              ))}
            </select>
          )}
        </Field>
      </div>

      <nav aria-label="Blocks" className="hidden lg:sticky lg:top-6 lg:block">
        <div className="grid gap-6">
          {GROUPS.map((group) => (
            <div key={group} className="grid gap-1">
              <p className="px-3 pb-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                {group}
              </p>
              <ul className="grid gap-1">
                {BLOCK_META.filter((meta) => meta.group === group).map(
                  (meta) => {
                    const active = meta.key === chosen;
                    return (
                      <li key={meta.key}>
                        <button
                          type="button"
                          aria-current={active ? "true" : undefined}
                          onClick={() => onChange(meta.key)}
                          className={cn(
                            "flex min-h-11 w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-start text-sm font-semibold text-[var(--color-neutral-charcoal)] transition-[background-color,scale] duration-150 ease-out hover:bg-[var(--color-neutral-off-white)] active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100",
                            focusRing,
                            active &&
                              "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]",
                          )}
                        >
                          <span className="min-w-0 break-words">
                            {meta.label}
                          </span>
                          {edited.has(meta.key) && (
                            <StatusPill tone="info">Edited</StatusPill>
                          )}
                        </button>
                      </li>
                    );
                  },
                )}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}

/* ───────── Editor ───────── */

/** Treats a changed field, or the list or object holding it, as touched. Returns dot paths. */
function changedPaths(
  saved: unknown,
  next: unknown,
  path = "",
  out: string[] = [],
): string[] {
  if (JSON.stringify(saved) === JSON.stringify(next)) return out;
  if (Array.isArray(saved) && Array.isArray(next)) {
    if (saved.length !== next.length) out.push(path);
    const length = Math.max(saved.length, next.length);
    for (let i = 0; i < length; i++) {
      changedPaths(saved[i], next[i], path ? `${path}.${i}` : String(i), out);
    }
    return out;
  }
  if (isRecord(saved) && isRecord(next)) {
    const keys = new Set([...Object.keys(saved), ...Object.keys(next)]);
    for (const key of keys) {
      changedPaths(saved[key], next[key], path ? `${path}.${key}` : key, out);
    }
    return out;
  }
  out.push(path);
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** An error shows once its field, or something inside it or holding it, has changed. */
function isTouched(errorPath: string, changed: string[]): boolean {
  return changed.some(
    (path) =>
      path === "" ||
      errorPath === path ||
      errorPath.startsWith(`${path}.`) ||
      path.startsWith(`${errorPath}.`),
  );
}

function EditorPane({
  meta,
  item,
  items,
  onDirtyChange,
  onReload,
}: {
  meta: BlockMeta;
  item: AdminSiteContentItem;
  items: AdminSiteContentItem[];
  onDirtyChange: (dirty: boolean) => void;
  onReload: () => Promise<AdminSiteContentItem | undefined>;
}) {
  const key = meta.key;
  // The copy the draft was loaded from. Refetches do not move it: a stale save is a 409.
  const [saved, setSaved] = useState<AdminSiteContentItem>(item);
  const [draft, setDraft] = useState<unknown>(item.value);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  // Bumped to ask for focus on the first invalid field after the next render.
  const [focusRequest, setFocusRequest] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const update = useUpdateSiteContent(key);
  const reset = useResetSiteContent(key);
  // The store follows the draft, so an upload or a submission's file shows as soon as it is used.
  const { state: media, replaceSaved } = useSiteMediaStore(item.media, draft);
  // The submissions behind this list's files, so a card can say "Uploaded by". Only the two card
  // lists fetch; the query is off for every other block.
  const cardLists = key === "testimonials" || key === "showcase";
  const sources = useSiteSources(
    key === "showcase" ? "showcase" : "testimonials",
    cardLists,
  );
  const owners = useMemo(
    () => sourceOwners(sources.data?.sources ?? []),
    [sources.data],
  );
  const siteMedia = useMemo(() => ({ ...media, owners }), [media, owners]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.value);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  useEffect(() => {
    if (focusRequest === 0) return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [focusRequest]);

  const check = useMemo(() => validateBlock(key, draft), [key, draft]);
  const clientErrors = check.ok ? {} : check.errors;
  // The preview shows uploads and built-in files as they will look on the landing page.
  const previewValue = useMemo(
    () => (check.ok ? resolveMedia(check.value, media.media) : null),
    [check, media.media],
  );
  const changed = useMemo(
    () => changedPaths(saved.value, draft),
    [saved.value, draft],
  );
  const visibleErrors: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(clientErrors).filter(
        ([path]) => submitted || isTouched(path, changed),
      ),
    ),
    ...serverErrors,
  };

  const Editor = EDITOR_COMPONENTS[key];
  // Blocks with a show/hide switch: a hidden one still previews, dimmed, with a note.
  const hidden =
    check.ok && (check.value as { enabled?: unknown }).enabled === false;
  const footer = savedBlock(items, "footer") as FooterBlock;
  const cta = savedBlock(items, "cta_banner") as CtaBannerBlock;

  function onDraftChange(next: unknown) {
    setDraft(next);
    if (Object.keys(serverErrors).length > 0) setServerErrors({});
  }

  function applySaved(next: AdminSiteContentItem) {
    setSaved(next);
    setDraft(next.value);
    setSubmitted(false);
    setServerErrors({});
    replaceSaved(next.media);
  }

  async function reloadDraft() {
    const next = await onReload();
    if (next) applySaved(next);
  }

  /** 409: someone else saved first. 400: the fields. Anything else gets a toast. */
  function onWriteError(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.status === 409) {
      toast.error(errorCodeMessage(err) ?? fallback, {
        action: { label: "Reload", onClick: () => void reloadDraft() },
      });
      return;
    }
    if (err instanceof ApiError && err.status === 400) {
      const fields = apiFieldErrors(err);
      if (Object.keys(fields).length > 0) {
        setServerErrors(fields);
        setFocusRequest((n) => n + 1);
        return;
      }
    }
    toastError(fallback, err);
  }

  function save() {
    if (media.busy > 0) return;
    setSubmitted(true);
    if (!check.ok) {
      setFocusRequest((n) => n + 1);
      toast.error("Fix the highlighted fields first.");
      return;
    }
    update.mutate(
      {
        value: check.value,
        expectedUpdatedAt: saved.isDefault ? null : saved.updatedAt,
      },
      {
        onSuccess: (next) => {
          applySaved(next);
          toast.success("Saved. The site updates in a few seconds.");
        },
        onError: (err) => onWriteError(err, "Could not save. Try again."),
      },
    );
  }

  function resetToDefault() {
    reset.mutate(
      { expectedUpdatedAt: saved.updatedAt },
      {
        onSuccess: (next) => {
          setResetOpen(false);
          applySaved(next);
          toast.success("Reset to the default.");
        },
        onError: (err) => {
          setResetOpen(false);
          onWriteError(err, "Could not reset. Try again.");
        },
      },
    );
  }

  return (
    <SiteMediaContext.Provider value={siteMedia}>
      <div className="flex min-w-0 flex-col gap-4">
        <Section
          title={meta.label}
          actions={
            !saved.isDefault && (
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                disabled={reset.isPending}
                className={cn(secondaryButton, "min-h-11")}
              >
                Reset to default
              </button>
            )
          }
        >
          <div className="grid gap-1">
            <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
              {meta.description}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
              {updatedText(saved)}
            </p>
          </div>
          <div ref={formRef}>
            {Editor ? (
              <Editor
                value={draft}
                onChange={onDraftChange}
                errors={visibleErrors}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Editor coming next.
              </p>
            )}
          </div>
        </Section>

        <Section title="Preview">
          {check.ok ? (
            <div className="grid gap-3">
              {hidden && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  This section is hidden on the landing page.
                </p>
              )}
              <div
                inert
                className="overflow-hidden rounded-[24px] border border-[var(--color-border-control)] bg-[var(--color-neutral-off-white)]"
              >
                <div className={cn("overflow-x-auto", hidden && "opacity-60")}>
                  <BlockPreview
                    block={key}
                    value={previewValue}
                    savedFooter={footer}
                    savedCta={cta}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Fix the highlighted fields to see the preview.
            </p>
          )}
        </Section>

        {dirty && (
          <SaveBar
            saving={update.isPending}
            uploading={media.busy > 0}
            onDiscard={() => {
              setDraft(saved.value);
              setSubmitted(false);
              setServerErrors({});
            }}
            onSave={save}
          />
        )}

        <ConfirmDialog
          open={resetOpen}
          title={`Reset ${meta.label}?`}
          onOpenChange={setResetOpen}
          actions={[
            {
              label: "Keep my version",
              variant: "secondary",
              onSelect: () => setResetOpen(false),
            },
            {
              label: "Reset",
              variant: "primary",
              onSelect: resetToDefault,
            },
          ]}
        >
          <p>This replaces the saved version with the original content.</p>
        </ConfirmDialog>
      </div>
    </SiteMediaContext.Provider>
  );
}

/** The saved value of a landing block, or the bundled default when the list lacks it. */
function savedBlock<K extends "footer" | "cta_banner">(
  items: AdminSiteContentItem[],
  key: K,
) {
  const row = items.find((item) => item.key === key);
  return (
    row ? row.value : SITE_CONTENT_DEFAULTS[key]
  ) as (typeof SITE_CONTENT_DEFAULTS)[K];
}

/** The save bar that appears while there are unsaved changes. Same look as the matching page's. */
function SaveBar({
  saving,
  uploading,
  onDiscard,
  onSave,
}: {
  saving: boolean;
  /** An upload is still running, so the file is not ready to save. */
  uploading: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-[var(--color-neutral-white)] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_-8px_24px_-12px_rgb(0_0_0/0.12)] sm:px-6">
      <div className="grid gap-0.5">
        <p
          aria-live="polite"
          className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
        >
          Unsaved changes
        </p>
        {uploading && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            Save when the upload finishes.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={saving}
          className={cn(ghostButton, "min-h-11")}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || uploading}
          aria-busy={saving || undefined}
          className={cn(primaryButton, "min-h-11")}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
