// Draft storage with no React, so lib/api.ts can clear drafts from any module, server ones included.
// Drafts are per device and per account. Storage that throws (private mode, blocked
// cookies) falls back to this map, which lasts until the tab reloads.
const PREFIX = "draft:v1:";
const VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const memory = new Map<string, string>();

/** Key for one account's form. Null (drafts off) until the account id is known. */
export function draftKey(
  accountId: string | null | undefined,
  form: string,
  variant?: string,
): string | null {
  if (!accountId) return null;
  return `${PREFIX}${accountId}:${form}${variant ? `:${variant}` : ""}`;
}

function readRaw(key: string): string | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) return raw;
  } catch {
    // Storage is blocked; the memory copy below is the only one.
  }
  return memory.get(key) ?? null;
}

function writeRaw(key: string, raw: string) {
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    memory.set(key, raw);
  }
}

export function removeRaw(key: string) {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to remove when storage is blocked.
  }
}

function isEntry(
  entry: unknown,
): entry is { v: number; savedAt: number; value: unknown } {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return e.v === VERSION && typeof e.savedAt === "number" && "value" in e;
}

export interface SavedDraft<T> {
  value: T;
  savedAt: number;
}

/** Reads a draft. A bad, old or wrong-version entry is dropped and reads as null. */
export function loadDraft<T>(
  key: string,
  now = Date.now(),
): SavedDraft<T> | null {
  const raw = readRaw(key);
  if (raw === null) return null;
  let entry: unknown = null;
  try {
    entry = JSON.parse(raw);
  } catch {
    entry = null;
  }
  if (!isEntry(entry) || now - entry.savedAt > TTL_MS) {
    removeRaw(key);
    return null;
  }
  return { value: entry.value as T, savedAt: entry.savedAt };
}

export function saveDraft(key: string, value: unknown) {
  try {
    writeRaw(key, JSON.stringify({ v: VERSION, savedAt: Date.now(), value }));
  } catch {
    // A value that cannot be serialised keeps the previous draft.
  }
}

/** Removes every draft on this device, for logout and account deletion. */
export function clearAllDrafts() {
  memory.clear();
  try {
    const storage = window.localStorage;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage is blocked, so there is nothing stored to clear.
  }
}
