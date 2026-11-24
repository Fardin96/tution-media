import { safeNext } from "./safe-next";

// A fix that leaves the form (for example, adding a zone) remembers where to come back to.
// A stack, newest last, so a fix made from inside another fix still leads back to each form.
const KEY = "returnTo:v2";
const OLD_KEY = "returnTo:v1";
const MAX = 3;
const TTL_MS = 2 * 60 * 60 * 1000;

const ALLOWED_PATHS = [
  "/dashboard/requirements/new",
  "/dashboard/tutor/packages/new",
  "/dashboard/tutor/requirements/new",
  "/dashboard/find-tuitions",
];

export interface ReturnTo {
  path: string;
  label: string;
  expiresAt: number;
}

function isAllowed(path: string): boolean {
  const safe = safeNext(path);
  return safe !== null && ALLOWED_PATHS.includes(safe.split("?")[0]);
}

const pathOf = (path: string) => path.split("?")[0];

/** Valid entries, oldest first. Expired, disallowed and malformed entries are dropped. */
function readStack(now: number): ReturnTo[] {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];

  let list: unknown = null;
  try {
    list = JSON.parse(raw);
  } catch {
    list = null;
  }
  const valid = (Array.isArray(list) ? list : []).filter(
    (e): e is ReturnTo =>
      typeof e?.path === "string" &&
      typeof e.label === "string" &&
      typeof e.expiresAt === "number" &&
      e.expiresAt > now &&
      isAllowed(e.path),
  );
  if (valid.length !== (Array.isArray(list) ? list.length : 0))
    writeStack(valid);
  return valid;
}

function writeStack(stack: ReturnTo[]) {
  try {
    if (stack.length === 0) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, JSON.stringify(stack));
  } catch {
    // Without session storage the banner is simply not shown.
  }
}

/** Remembers a fix that left a form. Pushing the same page again only refreshes its expiry. */
export function setReturnTo(path: string, label: string) {
  if (!isAllowed(path)) return;
  const stack = readStack(Date.now());
  const expiresAt = Date.now() + TTL_MS;
  const top = stack[stack.length - 1];
  if (top && pathOf(top.path) === pathOf(path)) {
    stack[stack.length - 1] = { path, label, expiresAt };
  } else {
    stack.push({ path, label, expiresAt });
  }
  writeStack(stack.slice(-MAX));
}

/** Removes the top entry once the person is back on its page. */
export function popReturnTo(path: string) {
  const stack = readStack(Date.now());
  const top = stack[stack.length - 1];
  if (top && pathOf(top.path) === pathOf(path)) writeStack(stack.slice(0, -1));
}

export function clearReturnTo() {
  try {
    window.sessionStorage.removeItem(KEY);
    window.sessionStorage.removeItem(OLD_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

/** The newest valid return trip, or null. */
export function readReturnTo(now = Date.now()): ReturnTo | null {
  const stack = readStack(now);
  return stack[stack.length - 1] ?? null;
}
