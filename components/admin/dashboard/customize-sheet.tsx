"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GROUP_LABEL,
  MAX_WIDGETS,
  countLayoutChanges,
  moveWidget,
  useResetDashboardLayout,
  useSaveDashboardLayout,
  type CatalogItem,
  type DashboardLayout,
  type WidgetId,
} from "@/lib/admin-dashboard";
import { ToggleSwitch } from "@/components/admin/matching-ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PendingLabel } from "@/components/ui/pending-label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  focusRing,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";

const GROUPS = Object.keys(GROUP_LABEL) as CatalogItem["group"][];

export function CustomizeSheet({
  open,
  onOpenChange,
  layout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: DashboardLayout;
}) {
  const save = useSaveDashboardLayout();
  const reset = useResetDashboardLayout();
  const dashboardHeading = useId();
  const addHeading = useId();

  const [draft, setDraft] = useState<WidgetId[]>(layout.widgets);
  const [wasOpen, setWasOpen] = useState(open);
  const [resetOpen, setResetOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Re-seed the draft each time the sheet opens; it is not re-seeded while open.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(layout.widgets);
  }

  const changes = countLayoutChanges(layout.widgets, draft);
  const dirty = changes > 0;
  const full = draft.length >= MAX_WIDGETS;
  const byId = useMemo(
    () => new Map(layout.catalog.map((item) => [item.id, item])),
    [layout.catalog],
  );
  const available = layout.catalog.filter((item) => !draft.includes(item.id));

  // Leaving the page with unsaved changes asks the browser to confirm.
  useEffect(() => {
    if (!open || !dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty]);

  // After a move, focus goes back to the same button; at an end it goes to the other one.
  const moveButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<{ id: WidgetId; by: -1 | 1 } | null>(null);
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const same = moveButtons.current.get(`${pending.id}:${pending.by}`);
    const other = moveButtons.current.get(`${pending.id}:${-pending.by}`);
    (same && !same.disabled ? same : other)?.focus();
  }, [draft]);

  function requestClose(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (dirty) setDiscardOpen(true);
    else onOpenChange(false);
  }

  function title(id: WidgetId) {
    return byId.get(id)?.title ?? id;
  }

  function toggle(id: WidgetId, on: boolean) {
    const next = on
      ? [...draft, id]
      : draft.filter((existing) => existing !== id);
    setDraft(next);
    setAnnouncement(
      on
        ? `Added ${title(id)} at position ${next.length} of ${next.length}.`
        : `Removed ${title(id)}.`,
    );
  }

  function move(id: WidgetId, by: -1 | 1) {
    const next = moveWidget(draft, id, by);
    if (next === draft) return;
    setDraft(next);
    pendingFocus.current = { id, by };
    setAnnouncement(
      `Moved ${title(id)} to position ${next.indexOf(id) + 1} of ${next.length}.`,
    );
  }

  async function handleSave() {
    try {
      await save.mutateAsync(draft);
      onOpenChange(false);
    } catch {
      // The hook shows the error toast; the draft stays so the user can retry.
    }
  }

  async function handleReset() {
    try {
      await reset.mutateAsync();
      setResetOpen(false);
      onOpenChange(false);
    } catch {
      // The hook shows the error toast; the confirm stays open for a retry.
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side="right"
          className="data-[side=right]:w-full sm:max-w-md"
        >
          <SheetHeader className="pe-12">
            <SheetTitle className="text-base font-semibold text-[var(--color-neutral-charcoal)]">
              Customize your dashboard
            </SheetTitle>
            <SheetDescription className="text-sm text-pretty text-[var(--color-text-secondary)]">
              Pick the widgets you want and their order. Only you see this
              layout.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {full && (
              <p className="mb-4 rounded-2xl bg-[var(--color-neutral-off-white)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                Your dashboard is full ({MAX_WIDGETS} widgets). Remove one to
                add another.
              </p>
            )}

            <section aria-labelledby={dashboardHeading} className="mb-8">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3
                  id={dashboardHeading}
                  className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
                >
                  On your dashboard
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
                  {draft.length} of {MAX_WIDGETS}
                </p>
              </div>
              <ol>
                {draft.map((id, index) => {
                  const item = byId.get(id);
                  if (!item) return null;
                  const lastOn = draft.length === 1;
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-2 border-b border-[var(--color-card-border)] last:border-b-0"
                    >
                      <span
                        aria-hidden="true"
                        className="w-6 shrink-0 text-center text-sm font-semibold text-[var(--color-text-secondary)] tabular-nums"
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 py-1">
                        <ToggleSwitch
                          label={item.title}
                          on
                          disabled={lastOn}
                          onChange={(next) => toggle(id, next)}
                        />
                      </div>
                      <MoveButton
                        title={item.title}
                        direction="up"
                        disabled={index === 0}
                        buttonRef={(el) =>
                          setMoveRef(moveButtons.current, `${id}:-1`, el)
                        }
                        onClick={() => move(id, -1)}
                      />
                      <MoveButton
                        title={item.title}
                        direction="down"
                        disabled={index === draft.length - 1}
                        buttonRef={(el) =>
                          setMoveRef(moveButtons.current, `${id}:1`, el)
                        }
                        onClick={() => move(id, 1)}
                      />
                    </li>
                  );
                })}
              </ol>
              {draft.length === 1 && (
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Keep at least one widget.
                </p>
              )}
            </section>

            <section aria-labelledby={addHeading}>
              <h3
                id={addHeading}
                className="mb-2 text-sm font-semibold text-[var(--color-neutral-charcoal)]"
              >
                Add widgets
              </h3>
              {available.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Every widget is on your dashboard.
                </p>
              ) : (
                GROUPS.map((group) => {
                  const items = available.filter(
                    (item) => item.group === group,
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={group} className="mb-4 last:mb-0">
                      <h4 className="mb-1 text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase">
                        {GROUP_LABEL[group]}
                      </h4>
                      <ul>
                        {items.map((item) => (
                          <li
                            key={item.id}
                            className="border-b border-[var(--color-card-border)] py-3 last:border-b-0"
                          >
                            <ToggleSwitch
                              label={item.title}
                              description={item.description}
                              on={false}
                              disabled={full}
                              onChange={(next) => toggle(item.id, next)}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </section>
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>

          <SheetFooter className="border-t border-[var(--color-card-border)] bg-[var(--color-neutral-white)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {dirty && `${changes} ${changes === 1 ? "change" : "changes"}`}
              </p>
              <button
                type="button"
                className={ghostButton}
                disabled={save.isPending}
                onClick={() => setResetOpen(true)}
              >
                Reset to default
              </button>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className={secondaryButton}
                disabled={!dirty || save.isPending}
                onClick={() => setDraft(layout.widgets)}
              >
                Discard
              </button>
              <button
                type="button"
                className={primaryButton}
                disabled={!dirty || save.isPending || reset.isPending}
                aria-busy={save.isPending || undefined}
                onClick={handleSave}
              >
                <PendingLabel pending={save.isPending}>Save</PendingLabel>
              </button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={resetOpen}
        title="Reset your dashboard?"
        onOpenChange={setResetOpen}
        actions={[
          {
            label: "Cancel",
            variant: "secondary",
            onSelect: () => setResetOpen(false),
          },
          {
            label: "Reset",
            variant: "danger",
            pending: reset.isPending,
            onSelect: handleReset,
          },
        ]}
      >
        <p>Your widgets go back to the default set and order.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={discardOpen}
        title="Discard unsaved changes?"
        onOpenChange={setDiscardOpen}
        actions={[
          {
            label: "Keep editing",
            variant: "secondary",
            onSelect: () => setDiscardOpen(false),
          },
          {
            label: "Discard",
            variant: "danger",
            onSelect: () => {
              setDiscardOpen(false);
              setDraft(layout.widgets);
              onOpenChange(false);
            },
          },
        ]}
      >
        <p>Your changes to the widgets and their order will be lost.</p>
      </ConfirmDialog>
    </>
  );
}

function setMoveRef(
  map: Map<string, HTMLButtonElement>,
  key: string,
  el: HTMLButtonElement | null,
) {
  if (el) map.set(key, el);
  else map.delete(key);
}

function MoveButton({
  title,
  direction,
  disabled,
  buttonRef,
  onClick,
}: {
  title: string;
  direction: "up" | "down";
  disabled: boolean;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
}) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={`Move ${title} ${direction}`}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full text-[var(--color-primary-core)] transition-colors duration-150 ease-out hover:bg-[var(--color-secondary-sky)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent motion-reduce:transition-none",
        focusRing,
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}
