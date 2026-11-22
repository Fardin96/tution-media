import { API_URL } from "./api";

export type PublicGetResult<T> =
  { ok: true; data: T } | { ok: false; status: number | null };

/**
 * GET a public API endpoint from the server, for prerendering and ISR. It never sends
 * credentials, so a response can be cached and shared: callers must only use it for data that
 * is the same for every visitor. `status` is null when nothing was asked (prefetch turned off,
 * no absolute API URL) or the request failed.
 *
 * DISABLE_SERVER_PREFETCH=1 (set by Playwright) skips the request, so the page falls back to
 * its client query and the e2e browser mocks still apply.
 */
export async function publicApiGet<T>(
  path: string,
  {
    revalidate,
    tags,
    timeoutMs = 3000,
  }: { revalidate: number; tags: string[]; timeoutMs?: number },
): Promise<PublicGetResult<T>> {
  if (process.env.DISABLE_SERVER_PREFETCH === "1") {
    return { ok: false, status: null };
  }
  if (!/^https?:\/\//.test(API_URL)) return { ok: false, status: null };
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate, tags },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: null };
  }
}
