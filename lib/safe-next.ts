/**
 * Accepts a `next` return path only when it is a plain path on this site. Anything else (a
 * scheme, a protocol-relative or backslash path, control characters, the auth pages, the API)
 * returns null, so the caller falls back to its default destination.
 */
const MAX_LENGTH = 500;
const LOOP_PREFIXES = ["/sign-in", "/sign-up", "/api/"];

export function safeNext(
  raw: string | string[] | undefined | null,
): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (raw.length > MAX_LENGTH) return null;
  try {
    if (new URL(raw, "http://x").origin !== "http://x") return null;
  } catch {
    return null;
  }
  if (
    LOOP_PREFIXES.some((p) => raw === p.replace(/\/$/, "") || raw.startsWith(p))
  ) {
    return null;
  }
  return raw;
}
