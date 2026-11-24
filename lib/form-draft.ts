import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadDraft,
  removeRaw,
  saveDraft,
  type SavedDraft,
} from "./draft-storage";
import { getStoredTokens } from "./token-storage";

export {
  clearAllDrafts,
  draftKey,
  loadDraft,
  saveDraft,
  type SavedDraft,
} from "./draft-storage";

const SAVE_DELAY_MS = 500;

/** "a moment ago", "5 minutes ago", "2 hours ago", or the date for older drafts. */
export function draftSavedAgo(savedAt: number, now = Date.now()): string {
  const minutes = Math.floor((now - savedAt) / 60_000);
  if (minutes < 1) return "a moment ago";
  if (minutes < 60)
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  return SHORT_DATE.format(savedAt);
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Dhaka",
});

export interface FormDraft<T> {
  /** The draft read for this key, or null (also null while not yet read). */
  restored: SavedDraft<T> | null;
  /** True once storage has been read for this key, so a null `restored` means no draft. */
  read: boolean;
  /** Removes the draft. */
  discard: () => void;
  /** Removes the draft and blocks saves for this mount. Call after a successful submit. */
  clear: () => void;
}

/**
 * Keeps a form's typed values between visits. Reads once when the key first appears (never
 * during render, so server and client markup match). Saves 500 ms after a change, and at once
 * when the page is hidden or unmounts, since client-side navigation keeps the JS alive.
 */
export function useFormDraft<T>({
  key,
  value,
  pristine,
}: {
  key: string | null;
  value: T;
  pristine: boolean;
}): FormDraft<T> {
  // The snapshot names the key it was read for, so a key change never shows the old account's draft.
  const [snap, setSnap] = useState<{
    key: string;
    found: SavedDraft<T> | null;
  } | null>(null);
  const latest = useRef({ key, value, pristine, blocked: false });

  useEffect(() => {
    if (!key) return;
    const found = loadDraft<T>(key);
    // Reading storage is an external sync, and it must run after mount (no hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnap({ key, found });
  }, [key]);

  const read = !!key && snap?.key === key;
  const restored = read ? (snap?.found ?? null) : null;

  useEffect(() => {
    latest.current = { ...latest.current, key, value, pristine };
  });

  useEffect(() => {
    if (!key || pristine || latest.current.blocked) return;
    const timer = setTimeout(() => {
      // Signed out (tokens cleared) means nothing is written, so a draft cannot reappear.
      if (!latest.current.blocked && getStoredTokens()) saveDraft(key, value);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [key, value, pristine]);

  useEffect(() => {
    const flush = () => {
      const cur = latest.current;
      if (cur.key && !cur.pristine && !cur.blocked && getStoredTokens()) {
        saveDraft(cur.key, cur.value);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

  const discard = useCallback(() => {
    const k = latest.current.key;
    if (k) removeRaw(k);
    setSnap((s) => (s ? { ...s, found: null } : s));
  }, []);

  const clear = useCallback(() => {
    latest.current.blocked = true;
    const k = latest.current.key;
    if (k) removeRaw(k);
  }, []);

  return { restored, read, discard, clear };
}

/**
 * One restore flow for every create form. Saving is held until the restore decision is made.
 * A draft is applied only while the form is still untouched (equal to `baseline`); once the
 * person has typed, the offer is dropped instead, so their typing is never overwritten.
 */
export function useRestoredDraft<T>({
  key,
  form,
  setForm,
  baseline,
  ready,
  sanitize,
  fresh,
  focusId,
}: {
  key: string | null;
  form: T;
  setForm: (next: T) => void;
  baseline: T;
  /** The lookup lists the draft is checked against have loaded. */
  ready: boolean;
  sanitize: (saved: T) => T;
  /** What "Start over" resets to (the template for Post again). */
  fresh: T;
  /** The page title to focus after "Start over". */
  focusId?: string;
}) {
  const [decidedKey, setDecidedKey] = useState<string | null>(null);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  // An untouched restore counts as pristine too, so it is not saved again (savedAt and TTL stay).
  const [restoredValue, setRestoredValue] = useState<T | null>(null);
  const pristine =
    JSON.stringify(form) === JSON.stringify(restoredValue ?? baseline);
  const holding = !!key && decidedKey !== key;
  const draft = useFormDraft<T>({
    key,
    value: form,
    pristine: holding || pristine,
  });
  const { read, restored, discard } = draft;

  // The decision reacts to storage and list loads, which only exist outside render, so it runs in
  // an effect. Saving starts only once it is made, so the screen and storage never disagree.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!holding || !read || !ready) return;
    if (restored && pristine) {
      const next = sanitize(restored.value);
      setForm(next);
      setRestoredValue(next);
      setRestoredAt(restored.savedAt);
    } else if (restored) {
      discard();
    }
    setDecidedKey(key);
  }, [
    holding,
    read,
    ready,
    restored,
    pristine,
    sanitize,
    setForm,
    discard,
    key,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const startOver = useCallback(() => {
    discard();
    setForm(fresh);
    setRestoredValue(null);
    setRestoredAt(null);
    if (focusId) document.getElementById(focusId)?.focus();
  }, [discard, setForm, fresh, focusId]);

  return { restoredAt, startOver, clear: draft.clear };
}
